import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { companies, products } from '../src/db/schema/index.js'
import { createLoss } from './servicos.js'
import { addDaysToIsoDate, todayIsoDate } from '../src/shared/utils/date.js'
import { authCookie, createTenant, createUser, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

interface AlertaOperacional {
  total: number
  outOfStockCount: number
  lowStockCount: number
  withoutMinStockCount: number
  lossesToday: { count: number; value: number }
  products: Array<{ id: string; name: string; status: 'sem_estoque' | 'abaixo_do_minimo' }>
}

async function criarProduto(
  tenant: { companyId: string; categoryId: string; unitId: string; admin: { id: string } },
  name: string,
  currentStock: string,
  minStock: string,
) {
  const [product] = await db
    .insert(products)
    .values({
      companyId: tenant.companyId,
      categoryId: tenant.categoryId,
      unitId: tenant.unitId,
      name,
      currentStock,
      minStock,
      createdBy: tenant.admin.id,
    })
    .returning({ id: products.id })
  return product.id
}

async function alertas(tenant: { admin: Parameters<typeof authCookie>[1] }) {
  const response = await ctx.app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { cookie: authCookie(ctx.app, tenant.admin) },
  })
  assert.equal(response.statusCode, 200)
  return response.json<AlertaOperacional>()
}

describe('alertas operacionais do sino', () => {
  test('separa produto zerado de produto abaixo do mínimo e soma os dois no contador', async () => {
    const tenant = await createTenant('alerta-separa', '50')
    await db.update(products).set({ minStock: '5' }).where(eq(products.id, tenant.productId))
    await criarProduto(tenant, 'Zerado', '0', '10')
    await criarProduto(tenant, 'Abaixo', '2', '10')

    const resultado = await alertas(tenant)

    assert.equal(resultado.outOfStockCount, 1)
    assert.equal(resultado.lowStockCount, 1)
    assert.equal(resultado.total, 2)
    assert.deepEqual(
      resultado.products.map(({ name, status }) => ({ name, status })),
      [
        { name: 'Zerado', status: 'sem_estoque' },
        { name: 'Abaixo', status: 'abaixo_do_minimo' },
      ],
    )
  })

  test('produto inativo e produto excluído ficam de fora', async () => {
    const tenant = await createTenant('alerta-inativos', '50')
    await db.update(products).set({ minStock: '5' }).where(eq(products.id, tenant.productId))
    const inativoId = await criarProduto(tenant, 'Inativo zerado', '0', '10')
    const excluidoId = await criarProduto(tenant, 'Excluído zerado', '0', '10')
    await db.update(products).set({ active: false }).where(eq(products.id, inativoId))
    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, excluidoId))

    const resultado = await alertas(tenant)

    assert.equal(resultado.total, 0)
    assert.deepEqual(resultado.products, [])
  })

  test('empresa só enxerga os próprios produtos', async () => {
    const empresaA = await createTenant('alerta-a', '50')
    const empresaB = await createTenant('alerta-b', '0')
    await db.update(products).set({ minStock: '5' }).where(eq(products.id, empresaA.productId))

    const resultadoA = await alertas(empresaA)
    const resultadoB = await alertas(empresaB)

    assert.equal(resultadoA.total, 0)
    assert.equal(resultadoB.total, 1)
    assert.deepEqual(resultadoB.products.map(({ id }) => id), [empresaB.productId])
  })

  test('lista para no quinto produto, com o contador reportando o total real', async () => {
    const tenant = await createTenant('alerta-corte', '50')
    await db.update(products).set({ minStock: '5' }).where(eq(products.id, tenant.productId))
    for (let i = 1; i <= 8; i += 1) await criarProduto(tenant, `Zerado ${i}`, '0', '10')

    const resultado = await alertas(tenant)

    assert.equal(resultado.outOfStockCount, 8)
    assert.equal(resultado.products.length, 5)
  })

  test('conta produto sem estoque mínimo definido sem somá-lo ao contador do sino', async () => {
    const tenant = await createTenant('alerta-sem-minimo', '50')

    const resultado = await alertas(tenant)

    assert.equal(resultado.withoutMinStockCount, 1)
    assert.equal(resultado.total, 0)
  })

  test('perda do dia entra como contexto, fora do contador do sino', async () => {
    const tenant = await createTenant('alerta-perdas', '20')
    await db.update(products).set({ minStock: '5', costPrice: '3.00' }).where(eq(products.id, tenant.productId))
    await createLoss(tenant.companyId, tenant.operator.id, {
      productId: tenant.productId,
      quantity: 4,
      reason: 'avariado',
    })

    const resultado = await alertas(tenant)

    assert.deepEqual(resultado.lossesToday, { count: 1, value: 12 })
    assert.equal(resultado.total, 0)
  })

  test('operador consulta os alertas', async () => {
    const tenant = await createTenant('alerta-operador', '0')

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json<AlertaOperacional>().total, 1)
  })
})

describe('alertas de cobrança da plataforma', () => {
  async function fixture(suffix: string) {
    const target = await createTenant(`alerta-cobranca-${suffix}`)
    const [platform] = await db
      .insert(companies)
      .values({ name: `Plataforma ${suffix}` })
      .returning({ id: companies.id })
    const superAdmin = await createUser(platform.id, 'super_admin', `alerta-cobranca-${suffix}`)
    return { target, superAdmin }
  }

  async function criarCobranca(cookie: string, companyId: string, dueDate: string, amount: number, paidAt?: string) {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/billings',
      headers: { cookie },
      payload: {
        companyId,
        referenceMonth: dueDate.slice(0, 7),
        dueDate,
        amount,
        paidAmount: paidAt ? amount : null,
        paidAt: paidAt ?? null,
        notes: null,
      },
    })
    assert.equal(response.statusCode, 201)
  }

  test('conta o atraso no sino e o vencimento próximo apenas como contexto', async () => {
    const { target, superAdmin } = await fixture('atraso')
    const cookie = authCookie(ctx.app, superAdmin)
    const hoje = todayIsoDate()
    await criarCobranca(cookie, target.companyId, addDaysToIsoDate(hoje, -10), 150)
    await criarCobranca(cookie, target.companyId, addDaysToIsoDate(hoje, 3), 200)
    await criarCobranca(cookie, target.companyId, addDaysToIsoDate(hoje, -40), 100, addDaysToIsoDate(hoje, -35))

    const response = await ctx.app.inject({ method: 'GET', url: '/api/billings/alerts', headers: { cookie } })

    assert.equal(response.statusCode, 200)
    const resultado = response.json<{
      total: number
      overdueCount: number
      overdueValue: number
      dueSoonCount: number
      billings: Array<{ companyName: string }>
    }>()
    assert.equal(resultado.overdueCount, 1)
    assert.equal(resultado.overdueValue, 150)
    assert.equal(resultado.dueSoonCount, 1)
    assert.equal(resultado.total, 1)
    assert.equal(resultado.billings.length, 1)
  })

  test('usuário de empresa-cliente não alcança os alertas de cobrança', async () => {
    const tenant = await createTenant('alerta-cobranca-negado')

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/billings/alerts',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })

    assert.equal(response.statusCode, 403)
  })
})
