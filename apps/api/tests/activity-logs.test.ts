import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

type ActivityLog = {
  action: string
  entity: string
  entityId: string | null
  entityLabel: string
  actorName: string | null
  details: Record<string, unknown> | null
}

async function listActivity(user: Parameters<typeof authCookie>[1], query = '') {
  return ctx.app.inject({
    method: 'GET',
    url: `/api/logs/activity?page=1&pageSize=50${query}`,
    headers: { cookie: authCookie(ctx.app, user) },
  })
}

describe('histórico de atividades por registro', () => {
  test('cadastrar, alterar e excluir um produto deixa o nome dele no histórico', async () => {
    const tenant = await createTenant('log-produto')
    const cookie = authCookie(ctx.app, tenant.admin)

    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie },
      payload: { categoryId: tenant.categoryId, unitId: tenant.unitId, name: 'Tomate Débora' },
    })
    assert.equal(created.statusCode, 201)
    const productId = created.json<{ id: string }>().id

    await ctx.app.inject({
      method: 'PUT',
      url: `/api/products/${productId}`,
      headers: { cookie },
      payload: { name: 'Tomate Débora Extra' },
    })
    await ctx.app.inject({ method: 'DELETE', url: `/api/products/${productId}`, headers: { cookie } })

    const response = await listActivity(tenant.admin)
    assert.equal(response.statusCode, 200)
    const logs = response.json<{ data: ActivityLog[] }>().data

    const doProduto = logs.filter((log) => log.entity === 'produto' && log.entityId === productId)
    assert.equal(doProduto.length, 3, 'deve haver um registro por operação')

    const porAcao = new Map(doProduto.map((log) => [log.action, log]))
    assert.equal(porAcao.get('criou')!.entityLabel, 'Tomate Débora')
    assert.equal(porAcao.get('alterou')!.entityLabel, 'Tomate Débora Extra')
    assert.equal(
      porAcao.get('excluiu')!.entityLabel,
      'Tomate Débora Extra',
      'o nome precisa sobreviver à exclusão do produto',
    )
    assert.equal(porAcao.get('criou')!.actorName, tenant.admin.name)
  })

  test('exclusão em lote registra uma linha por registro removido', async () => {
    const tenant = await createTenant('log-lote')
    const cookie = authCookie(ctx.app, tenant.admin)

    const ids: string[] = []
    for (const name of ['Manga', 'Uva', 'Kiwi']) {
      const created = await ctx.app.inject({
        method: 'POST',
        url: '/api/products',
        headers: { cookie },
        payload: { categoryId: tenant.categoryId, unitId: tenant.unitId, name },
      })
      ids.push(created.json<{ id: string }>().id)
    }

    await ctx.app.inject({ method: 'POST', url: '/api/products/bulk-delete', headers: { cookie }, payload: { ids } })

    const logs = (await listActivity(tenant.admin)).json<{ data: ActivityLog[] }>().data
    const excluidos = logs.filter((log) => log.action === 'excluiu' && log.entity === 'produto')
    assert.deepEqual(excluidos.map((log) => log.entityLabel).sort(), ['Kiwi', 'Manga', 'Uva'])
  })

  test('a importação por planilha aparece como um evento resumido', async () => {
    const tenant = await createTenant('log-import')
    const cookie = authCookie(ctx.app, tenant.admin)

    await ctx.app.inject({
      method: 'POST',
      url: '/api/products/import',
      headers: { cookie },
      payload: {
        createMissingRefs: true,
        rows: [
          { line: 2, name: 'Cenoura', categoryName: 'Legumes', unitName: 'Quilo' },
          { line: 3, name: 'Batata', categoryName: 'Legumes', unitName: 'Quilo' },
        ],
      },
    })

    const logs = (await listActivity(tenant.admin, '&action=importou')).json<{ data: ActivityLog[] }>().data
    assert.equal(logs.length, 1)
    assert.equal(logs[0].entity, 'produto')
    assert.match(logs[0].entityLabel, /2 produto/)
    assert.deepEqual(logs[0].details?.categoriasCriadas, ['Legumes'])
  })

  test('categoria e usuário também entram no histórico', async () => {
    const tenant = await createTenant('log-outros')
    const cookie = authCookie(ctx.app, tenant.admin)

    await ctx.app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { cookie },
      payload: { name: 'Bebidas' },
    })
    await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie },
      payload: { name: 'Maria Operadora', email: 'maria-log@test.local', password: 'senha-forte-123', role: 'operador' },
    })

    const logs = (await listActivity(tenant.admin)).json<{ data: ActivityLog[] }>().data
    assert.ok(logs.some((log) => log.entity === 'categoria' && log.entityLabel === 'Bebidas'))
    assert.ok(logs.some((log) => log.entity === 'usuario' && log.entityLabel === 'Maria Operadora'))
  })

  test('o histórico é exclusivo do admin e não vaza entre empresas', async () => {
    const tenantA = await createTenant('log-iso-a')
    const tenantB = await createTenant('log-iso-b')

    await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie: authCookie(ctx.app, tenantB.admin) },
      payload: { categoryId: tenantB.categoryId, unitId: tenantB.unitId, name: 'Segredo da empresa B' },
    })

    const gerente = await listActivity(tenantA.manager)
    assert.equal(gerente.statusCode, 403, 'apenas admin consulta o histórico')

    const logsA = (await listActivity(tenantA.admin)).json<{ data: ActivityLog[] }>().data
    assert.ok(
      !logsA.some((log) => log.entityLabel === 'Segredo da empresa B'),
      'a empresa A não pode ver atividade da empresa B',
    )
  })

  test('filtra por tipo de registro', async () => {
    const tenant = await createTenant('log-filtro')
    const cookie = authCookie(ctx.app, tenant.admin)

    await ctx.app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { cookie },
      payload: { name: 'Congelados' },
    })
    await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie },
      payload: { categoryId: tenant.categoryId, unitId: tenant.unitId, name: 'Ervilha' },
    })

    const logs = (await listActivity(tenant.admin, '&entity=categoria')).json<{ data: ActivityLog[] }>().data
    assert.ok(logs.length > 0)
    assert.ok(logs.every((log) => log.entity === 'categoria'))
  })
})
