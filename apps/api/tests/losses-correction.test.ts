import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { and, eq } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { activityLogs, losses, products, stockMovements } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

async function registerLoss(tenant: Awaited<ReturnType<typeof createTenant>>, quantity = 10) {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/losses',
    headers: { cookie: authCookie(ctx.app, tenant.operator) },
    payload: { productId: tenant.productId, quantity, reason: 'vencido', notes: 'lançamento original' },
  })
  assert.equal(response.statusCode, 201)
  return response.json()
}

function currentStock(productId: string) {
  return db
    .select({ currentStock: products.currentStock })
    .from(products)
    .where(eq(products.id, productId))
    .then(([product]) => Number(product.currentStock))
}

describe('correção de perda lançada errado', () => {
  it('admin corrige motivo e observações sem tocar no estoque', async () => {
    const tenant = await createTenant('corrigir', '100')
    const loss = await registerLoss(tenant)
    const stockAfterLoss = await currentStock(tenant.productId)

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/losses/${loss.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { reason: 'avariado', notes: 'motivo corrigido' },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().reason, 'avariado')
    assert.equal(response.json().notes, 'motivo corrigido')
    assert.equal(await currentStock(tenant.productId), stockAfterLoss, 'corrigir não mexe no estoque')
  })

  it('operador não corrige perda (exige admin ou gerente)', async () => {
    const tenant = await createTenant('corrigir-papel', '100')
    const loss = await registerLoss(tenant)

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/losses/${loss.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { reason: 'avariado' },
    })

    assert.equal(response.statusCode, 403)
  })

  it('perda de outra empresa não é corrigível', async () => {
    const owner = await createTenant('corrigir-dono', '100')
    const intruder = await createTenant('corrigir-intruso', '100')
    const loss = await registerLoss(owner)

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/losses/${loss.id}`,
      headers: { cookie: authCookie(ctx.app, intruder.admin) },
      payload: { reason: 'avariado' },
    })

    assert.equal(response.statusCode, 404)
  })

  it('não aceita alterar produto, quantidade ou data pela correção', async () => {
    const tenant = await createTenant('corrigir-imutavel', '100')
    const other = await createTenant('corrigir-outro', '100')
    const loss = await registerLoss(tenant, 10)

    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/losses/${loss.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { reason: 'avariado', productId: other.productId, quantity: 999, lossDate: '2020-01-01' },
    })

    const [saved] = await db
      .select({ productId: losses.productId, quantity: losses.quantity, lossDate: losses.lossDate })
      .from(losses)
      .where(eq(losses.id, loss.id))

    assert.equal(saved.productId, tenant.productId, 'produto permanece o original')
    assert.equal(Number(saved.quantity), 10, 'quantidade permanece a original')
    assert.equal(new Date(saved.lossDate).getUTCFullYear(), new Date().getUTCFullYear())
    assert.equal(await currentStock(tenant.productId), 90)
    assert.equal(await currentStock(other.productId), 100, 'produto de outra empresa intacto')
  })
})

describe('cancelamento de perda', () => {
  it('devolve a quantidade ao estoque como ajuste rastreável', async () => {
    const tenant = await createTenant('cancelar', '100')
    const loss = await registerLoss(tenant, 30)
    assert.equal(await currentStock(tenant.productId), 70)

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/losses/${loss.id}/cancel`,
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { cancelReason: 'quantidade digitada errada' },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(await currentStock(tenant.productId), 100, 'estoque volta ao valor anterior à perda')

    const body = response.json()
    assert.ok(body.cancelledAt, 'a perda fica marcada como cancelada')
    assert.equal(body.cancelReason, 'quantidade digitada errada')

    const movements = await db
      .select({ type: stockMovements.type, quantity: stockMovements.quantity, referenceType: stockMovements.referenceType })
      .from(stockMovements)
      .where(and(eq(stockMovements.companyId, tenant.companyId), eq(stockMovements.referenceId, loss.id)))

    assert.equal(movements.length, 2, 'a perda e o estorno ficam os dois no histórico')
    const estorno = movements.find((movement) => movement.referenceType === 'loss_cancellation')
    assert.ok(estorno, 'existe movimento de estorno')
    assert.equal(estorno.type, 'ajuste')
    assert.equal(Number(estorno.quantity), 30)
  })

  it('sai da listagem e dos relatórios, mas aparece com o filtro ligado', async () => {
    const tenant = await createTenant('cancelar-listagem', '100')
    const cookie = authCookie(ctx.app, tenant.admin)
    const loss = await registerLoss(tenant, 5)

    await ctx.app.inject({
      method: 'POST',
      url: `/api/losses/${loss.id}/cancel`,
      headers: { cookie },
      payload: { cancelReason: 'produto errado' },
    })

    const listagem = await ctx.app.inject({ method: 'GET', url: '/api/losses', headers: { cookie } })
    assert.equal(listagem.json().total, 0, 'listagem padrão esconde canceladas')

    const comFiltro = await ctx.app.inject({
      method: 'GET',
      url: '/api/losses?includeCancelled=true',
      headers: { cookie },
    })
    assert.equal(comFiltro.json().total, 1, 'o filtro mostra a cancelada')
    assert.equal(comFiltro.json().data[0].cancelReason, 'produto errado')

    const relatorio = await ctx.app.inject({ method: 'GET', url: '/api/reports/losses', headers: { cookie } })
    assert.equal(relatorio.json().total, 0)
    assert.deepEqual(relatorio.json().byReason, [], 'agregados por motivo ignoram cancelada')
  })

  it('não conta no valor perdido do dashboard', async () => {
    const tenant = await createTenant('cancelar-dashboard', '100')
    const cookie = authCookie(ctx.app, tenant.admin)
    await db.update(products).set({ costPrice: '10.00' }).where(eq(products.id, tenant.productId))

    const mantida = await registerLoss(tenant, 2)
    const cancelada = await registerLoss(tenant, 8)

    const antes = await ctx.app.inject({ method: 'GET', url: '/api/dashboard/summary', headers: { cookie } })
    assert.equal(antes.json().lossesInPeriod.lossValue, 100, '2 + 8 unidades a R$ 10,00')

    await ctx.app.inject({
      method: 'POST',
      url: `/api/losses/${cancelada.id}/cancel`,
      headers: { cookie },
      payload: { cancelReason: 'lançamento duplicado' },
    })

    const depois = await ctx.app.inject({ method: 'GET', url: '/api/dashboard/summary', headers: { cookie } })
    assert.equal(depois.json().lossesInPeriod.lossValue, 20, 'sobra só a perda mantida')
    assert.equal(depois.json().lossesInPeriod.lossesCount, 1)
    assert.ok(mantida.id)
  })

  it('cancelar duas vezes não devolve estoque em dobro', async () => {
    const tenant = await createTenant('cancelar-duplo', '100')
    const cookie = authCookie(ctx.app, tenant.admin)
    const loss = await registerLoss(tenant, 20)

    const primeiro = await ctx.app.inject({
      method: 'POST',
      url: `/api/losses/${loss.id}/cancel`,
      headers: { cookie },
      payload: { cancelReason: 'primeiro' },
    })
    const segundo = await ctx.app.inject({
      method: 'POST',
      url: `/api/losses/${loss.id}/cancel`,
      headers: { cookie },
      payload: { cancelReason: 'segundo' },
    })

    assert.equal(primeiro.statusCode, 200)
    assert.equal(segundo.statusCode, 409)
    assert.equal(await currentStock(tenant.productId), 100)
  })

  it('cancelamentos simultâneos da mesma perda: só um passa', async () => {
    const tenant = await createTenant('cancelar-corrida', '100')
    const cookie = authCookie(ctx.app, tenant.admin)
    const loss = await registerLoss(tenant, 25)

    const respostas = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        ctx.app.inject({
          method: 'POST',
          url: `/api/losses/${loss.id}/cancel`,
          headers: { cookie },
          payload: { cancelReason: `tentativa ${index}` },
        }),
      ),
    )

    const aceitos = respostas.filter((response) => response.statusCode === 200)
    assert.equal(aceitos.length, 1, 'o lock serializa e só o primeiro cancela')
    assert.equal(await currentStock(tenant.productId), 100, 'estoque devolvido uma única vez')

    const estornos = await db
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(and(eq(stockMovements.referenceId, loss.id), eq(stockMovements.referenceType, 'loss_cancellation')))
    assert.equal(estornos.length, 1)
  })

  it('perda cancelada não pode mais ser corrigida', async () => {
    const tenant = await createTenant('cancelar-imutavel', '100')
    const cookie = authCookie(ctx.app, tenant.admin)
    const loss = await registerLoss(tenant, 5)

    await ctx.app.inject({
      method: 'POST',
      url: `/api/losses/${loss.id}/cancel`,
      headers: { cookie },
      payload: { cancelReason: 'erro' },
    })

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/losses/${loss.id}`,
      headers: { cookie },
      payload: { reason: 'avariado' },
    })

    assert.equal(response.statusCode, 409)
  })

  it('exige motivo do cancelamento', async () => {
    const tenant = await createTenant('cancelar-sem-motivo', '100')
    const cookie = authCookie(ctx.app, tenant.admin)
    const loss = await registerLoss(tenant, 5)

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/losses/${loss.id}/cancel`,
      headers: { cookie },
      payload: { cancelReason: '   ' },
    })

    assert.equal(response.statusCode, 422)
    assert.equal(await currentStock(tenant.productId), 95, 'nada é estornado quando a validação falha')
  })

  it('operador não cancela perda (exige admin ou gerente)', async () => {
    const tenant = await createTenant('cancelar-papel', '100')
    const loss = await registerLoss(tenant, 5)

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/losses/${loss.id}/cancel`,
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { cancelReason: 'tentativa' },
    })

    assert.equal(response.statusCode, 403)
    assert.equal(await currentStock(tenant.productId), 95)
  })

  it('funciona mesmo quando o produto foi excluído depois do lançamento', async () => {
    const tenant = await createTenant('cancelar-produto-excluido', '100')
    const cookie = authCookie(ctx.app, tenant.admin)
    const loss = await registerLoss(tenant, 10)

    // Produto excluído logicamente DEPOIS de a perda já existir.
    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, tenant.productId))

    const listagem = await ctx.app.inject({ method: 'GET', url: '/api/losses', headers: { cookie } })
    assert.equal(listagem.json().total, 1, 'a perda continua no histórico da empresa')

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/losses/${loss.id}/cancel`,
      headers: { cookie },
      payload: { cancelReason: 'produto excluído depois' },
    })

    assert.equal(response.statusCode, 200, 'produto excluído não pode impedir o estorno')
    assert.equal(await currentStock(tenant.productId), 100)
  })

  it('produto excluído continua bloqueado para lançar perda nova', async () => {
    const tenant = await createTenant('perda-produto-excluido', '100')
    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, tenant.productId))

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { productId: tenant.productId, quantity: 1, reason: 'vencido' },
    })

    assert.equal(response.statusCode, 404, 'a permissão vale só para estorno, não para lançamento novo')
  })

  it('registra na auditoria quem cancelou e o que foi estornado', async () => {
    const tenant = await createTenant('cancelar-auditoria', '100')
    const loss = await registerLoss(tenant, 7)

    await ctx.app.inject({
      method: 'POST',
      url: `/api/losses/${loss.id}/cancel`,
      headers: { cookie: authCookie(ctx.app, tenant.manager) },
      payload: { cancelReason: 'contagem refeita' },
    })

    const [log] = await db
      .select({
        action: activityLogs.action,
        entity: activityLogs.entity,
        entityLabel: activityLogs.entityLabel,
        actorId: activityLogs.actorId,
        details: activityLogs.details,
      })
      .from(activityLogs)
      .where(and(eq(activityLogs.companyId, tenant.companyId), eq(activityLogs.entityId, loss.id)))

    assert.equal(log.action, 'cancelou')
    assert.equal(log.entity, 'perda')
    assert.equal(log.entityLabel, 'Produto cancelar-auditoria')
    assert.equal(log.actorId, tenant.manager.id)
    assert.equal(log.details?.motivo, 'contagem refeita')
  })
})
