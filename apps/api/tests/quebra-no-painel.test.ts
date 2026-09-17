import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { products } from '../src/db/schema/index.js'
import { createLoss, createStockEntry } from './servicos.js'
import { authCookie, createTenant, setupTestApp, type TenantFixture } from './helpers.js'

const ctx = setupTestApp()

type Quebra = {
  lossValue: number
  entriesValue: number
  percent: number | null
  targetPercent: number
}

function quebra(tenant: TenantFixture) {
  return ctx.app
    .inject({ method: 'GET', url: '/api/dashboard/summary', headers: { cookie: authCookie(ctx.app, tenant.admin) } })
    .then((response) => {
      assert.equal(response.statusCode, 200)
      return response.json<{ shrinkage: Quebra }>().shrinkage
    })
}

async function definirCusto(tenant: TenantFixture, custo: string) {
  await db.update(products).set({ costPrice: custo }).where(eq(products.id, tenant.productId))
}

describe('quebra no painel', () => {
  test('divide o custo perdido pelo custo que entrou no período', async () => {
    const tenant = await createTenant('quebra-conta')
    await definirCusto(tenant, '2.00')
    await createStockEntry(tenant.companyId, tenant.operator.id, {
      items: [{ productId: tenant.productId, quantity: 100, unitCost: 2 }],
    })
    await createLoss(tenant.companyId, tenant.operator.id, {
      productId: tenant.productId,
      quantity: 5,
      reason: 'vencido',
    })

    const resultado = await quebra(tenant)
    assert.equal(resultado.entriesValue, 200)
    assert.equal(resultado.lossValue, 10)
    assert.equal(resultado.percent, 5)
    assert.equal(resultado.targetPercent, 5)
  })

  test('sem entrada no período o percentual é nulo, não zero', async () => {
    const tenant = await createTenant('quebra-sem-entrada', '50')
    await definirCusto(tenant, '3.00')
    await createLoss(tenant.companyId, tenant.operator.id, {
      productId: tenant.productId,
      quantity: 4,
      reason: 'avariado',
    })

    const resultado = await quebra(tenant)
    assert.equal(resultado.entriesValue, 0)
    assert.equal(resultado.lossValue, 12)
    assert.equal(resultado.percent, null)
  })

  test('item sem custo na nota cai no custo cadastrado do produto', async () => {
    const tenant = await createTenant('quebra-sem-custo-no-item')
    await definirCusto(tenant, '4.00')
    await createStockEntry(tenant.companyId, tenant.operator.id, {
      items: [{ productId: tenant.productId, quantity: 10 }],
    })

    const resultado = await quebra(tenant)
    assert.equal(resultado.entriesValue, 40)
  })

  test('entrada de outra empresa não entra no divisor', async () => {
    const vizinha = await createTenant('quebra-vizinha')
    await definirCusto(vizinha, '9.00')
    await createStockEntry(vizinha.companyId, vizinha.operator.id, {
      items: [{ productId: vizinha.productId, quantity: 100, unitCost: 9 }],
    })

    const tenant = await createTenant('quebra-isolada')
    await definirCusto(tenant, '1.00')
    await createStockEntry(tenant.companyId, tenant.operator.id, {
      items: [{ productId: tenant.productId, quantity: 10, unitCost: 1 }],
    })

    const resultado = await quebra(tenant)
    assert.equal(resultado.entriesValue, 10)
  })
})
