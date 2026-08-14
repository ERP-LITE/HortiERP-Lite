import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { and, eq } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { companies, users } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

async function createPlatformAdmin(suffix: string) {
  const platform = await createTenant(suffix)
  await db.update(users).set({ role: 'super_admin' }).where(eq(users.id, platform.admin.id))
  return {
    ...platform,
    cookie: authCookie(ctx.app, { ...platform.admin, role: 'super_admin' }),
  }
}

describe('campos opcionais do produto podem ser limpos', () => {
  it('apagar SKU, código de barras e preços salva os campos vazios', async () => {
    const tenant = await createTenant('limpar-campos')
    const cookie = authCookie(ctx.app, tenant.admin)

    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie },
      payload: {
        categoryId: tenant.categoryId,
        unitId: tenant.unitId,
        name: 'Banana Prata',
        sku: 'BAN-1',
        barcode: '7891234567895',
        costPrice: 5.5,
        salePrice: 8.9,
      },
    })
    assert.equal(created.statusCode, 201)

    const updated = await ctx.app.inject({
      method: 'PUT',
      url: `/api/products/${created.json().id}`,
      headers: { cookie },
      // Exatamente o que a tela manda quando os campos são apagados.
      payload: { sku: null, barcode: null, costPrice: null, salePrice: null },
    })

    assert.equal(updated.statusCode, 200)
    const product = updated.json()
    assert.equal(product.sku, null)
    assert.equal(product.barcode, null)
    assert.equal(product.costPrice, null)
    assert.equal(product.salePrice, null)
  })

  it('omitir a chave continua preservando o valor atual', async () => {
    const tenant = await createTenant('preservar-campos')
    const cookie = authCookie(ctx.app, tenant.admin)

    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie },
      payload: {
        categoryId: tenant.categoryId,
        unitId: tenant.unitId,
        name: 'Manga Palmer',
        sku: 'MAN-1',
        costPrice: 4.25,
      },
    })

    const updated = await ctx.app.inject({
      method: 'PUT',
      url: `/api/products/${created.json().id}`,
      headers: { cookie },
      payload: { name: 'Manga Palmer Extra' },
    })

    assert.equal(updated.statusCode, 200)
    assert.equal(updated.json().sku, 'MAN-1')
    assert.equal(updated.json().costPrice, '4.25')
  })

  it('dois produtos sem SKU não colidem no índice único', async () => {
    const tenant = await createTenant('sku-vazio')
    const cookie = authCookie(ctx.app, tenant.admin)
    const base = { categoryId: tenant.categoryId, unitId: tenant.unitId, sku: '' }

    const primeiro = await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie },
      payload: { ...base, name: 'Alface Crespa' },
    })
    const segundo = await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie },
      payload: { ...base, name: 'Rúcula' },
    })

    assert.equal(primeiro.statusCode, 201)
    assert.equal(segundo.statusCode, 201)
    assert.equal(primeiro.json().sku, null)
    assert.equal(segundo.json().sku, null)
  })
})

describe('admin não consegue se trancar fora da empresa', () => {
  it('rejeita rebaixar o próprio perfil de acesso', async () => {
    const tenant = await createTenant('auto-rebaixar')
    const cookie = authCookie(ctx.app, tenant.admin)

    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${tenant.admin.id}`,
      headers: { cookie },
      payload: { role: 'operador' },
    })

    assert.equal(response.statusCode, 409)
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.companyId, tenant.companyId), eq(users.role, 'admin')))
    assert.equal(admins.length, 1, 'a empresa continua com admin')
  })

  it('rejeita desativar a própria conta', async () => {
    const tenant = await createTenant('auto-desativar')
    const cookie = authCookie(ctx.app, tenant.admin)

    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${tenant.admin.id}`,
      headers: { cookie },
      payload: { active: false },
    })

    assert.equal(response.statusCode, 409)
    const seguinte = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: { cookie } })
    assert.equal(seguinte.statusCode, 200, 'a sessão continua válida')
  })

  it('continua permitindo editar o próprio nome e alterar outros usuários', async () => {
    const tenant = await createTenant('editar-outros')
    const cookie = authCookie(ctx.app, tenant.admin)

    const proprioNome = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${tenant.admin.id}`,
      headers: { cookie },
      payload: { name: 'Admin Renomeado' },
    })
    assert.equal(proprioNome.statusCode, 200)

    const outro = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${tenant.operator.id}`,
      headers: { cookie },
      payload: { active: false, role: 'gerente' },
    })
    assert.equal(outro.statusCode, 200)
  })
})

describe('suspender e reativar empresa', () => {
  it('reativar não devolve acesso a quem foi desativado individualmente', async () => {
    const platform = await createPlatformAdmin('suspensao-plat')
    const tenant = await createTenant('suspensao')

    // Funcionário desligado, desativado pelo admin antes de qualquer suspensão.
    await db.update(users).set({ active: false }).where(eq(users.id, tenant.operator.id))

    for (const active of [false, true]) {
      const response = await ctx.app.inject({
        method: 'PATCH',
        url: `/api/companies/${tenant.companyId}/active`,
        headers: { cookie: platform.cookie },
        payload: { active },
      })
      assert.equal(response.statusCode, 200)
    }

    const [operator] = await db
      .select({ active: users.active })
      .from(users)
      .where(eq(users.id, tenant.operator.id))
    assert.equal(operator.active, false, 'quem estava desativado continua desativado')

    const [admin] = await db.select({ active: users.active }).from(users).where(eq(users.id, tenant.admin.id))
    assert.equal(admin.active, true, 'quem estava ativo volta a acessar')
  })

  it('empresa suspensa bloqueia a sessão de quem já estava autenticado', async () => {
    const platform = await createPlatformAdmin('bloqueio-plat')
    const tenant = await createTenant('bloqueio')
    const cookie = authCookie(ctx.app, tenant.admin)

    const antes = await ctx.app.inject({ method: 'GET', url: '/api/products', headers: { cookie } })
    assert.equal(antes.statusCode, 200)

    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/companies/${tenant.companyId}/active`,
      headers: { cookie: platform.cookie },
      payload: { active: false },
    })

    const depois = await ctx.app.inject({ method: 'GET', url: '/api/products', headers: { cookie } })
    assert.equal(depois.statusCode, 401, 'suspender invalida o JWT já emitido')
  })
})

describe('cobranças só valem para empresa-cliente', () => {
  it('recusa cobrança para a própria empresa da plataforma', async () => {
    const platform = await createPlatformAdmin('cobranca-plat')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/billings',
      headers: { cookie: platform.cookie },
      payload: {
        companyId: platform.companyId,
        referenceMonth: '2026-08',
        dueDate: '2026-08-20',
        amount: 100,
      },
    })

    assert.equal(response.statusCode, 403)
  })

  it('recusa cobrança para empresa excluída', async () => {
    const platform = await createPlatformAdmin('cobranca-excluida')
    const tenant = await createTenant('cobranca-alvo')
    await db.update(companies).set({ deletedAt: new Date() }).where(eq(companies.id, tenant.companyId))

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/billings',
      headers: { cookie: platform.cookie },
      payload: {
        companyId: tenant.companyId,
        referenceMonth: '2026-08',
        dueDate: '2026-08-20',
        amount: 100,
      },
    })

    assert.equal(response.statusCode, 404)
  })

  it('aceita cobrança para empresa-cliente ativa', async () => {
    const platform = await createPlatformAdmin('cobranca-ok-plat')
    const tenant = await createTenant('cobranca-ok')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/billings',
      headers: { cookie: platform.cookie },
      payload: {
        companyId: tenant.companyId,
        referenceMonth: '2026-08',
        dueDate: '2026-08-20',
        amount: 149.9,
      },
    })

    assert.equal(response.statusCode, 201)
  })
})
