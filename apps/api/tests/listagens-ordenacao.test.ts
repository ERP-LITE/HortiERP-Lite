import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authCookie, createTenant, createUser, setupTestApp } from './helpers.js'
import { createLoss, createStockEntry } from './servicos.js'
import { listProductsQuerySchema } from '../src/modules/products/products.schema.js'
import { listCategoriesQuerySchema } from '../src/modules/categories/categories.schema.js'
import { listUnitsQuerySchema } from '../src/modules/units/units.schema.js'
import { listUsersQuerySchema } from '../src/modules/users/users.schema.js'
import { listStockQuerySchema, listStockMovementsQuerySchema } from '../src/modules/stock/stock.schema.js'
import { listStockEntriesQuerySchema } from '../src/modules/stock-entries/stock-entries.schema.js'
import { listLossesQuerySchema } from '../src/modules/losses/losses.schema.js'
import { listStockCountsQuerySchema } from '../src/modules/stock-counts/stock-counts.schema.js'
import { listActivityQuerySchema, listLogsQuerySchema } from '../src/modules/logs/logs.schema.js'
import { listCompaniesQuerySchema } from '../src/modules/companies/companies.schema.js'
import { listPlatformUsersQuerySchema } from '../src/modules/companies/platform-users.schema.js'
import { listBillingsQuerySchema } from '../src/modules/billings/billings.schema.js'

const ctx = setupTestApp({ rateLimit: false })
const listagens = [
  ['/products', listProductsQuerySchema, false],
  ['/categories', listCategoriesQuerySchema, false],
  ['/units', listUnitsQuerySchema, false],
  ['/users', listUsersQuerySchema, false],
  ['/stock', listStockQuerySchema, false],
  ['/stock/movements', listStockMovementsQuerySchema, false],
  ['/stock-entries', listStockEntriesQuerySchema, false],
  ['/losses', listLossesQuerySchema, false],
  ['/stock-counts', listStockCountsQuerySchema, false],
  ['/logs/activity', listActivityQuerySchema, false],
  ['/logs/technical', listLogsQuerySchema, true],
  ['/companies', listCompaniesQuerySchema, true],
  ['/platform-users', listPlatformUsersQuerySchema, true],
  ['/billings', listBillingsQuerySchema, true],
] as const

for (const [rota, schema, plataforma] of listagens) {
  test(`${rota}: todas as colunas ordenáveis funcionam nos dois sentidos e parâmetros inválidos são recusados`, async () => {
    const tenant = await createTenant(`ordem-${rota.replaceAll('/', '-')}`, '10')
    const user = plataforma ? await createUser(tenant.companyId, 'super_admin', 'ordem-plataforma') : tenant.admin
    const headers = { cookie: authCookie(ctx.app, user) }
    if (!plataforma) {
      await createStockEntry(tenant.companyId, tenant.admin.id, { items: [{ productId: tenant.productId, quantity: 2 }] })
      await createLoss(tenant.companyId, tenant.admin.id, { productId: tenant.productId, quantity: 1, reason: 'vencido' })
      const contagem = await ctx.app.inject({ method: 'POST', url: '/api/stock-counts', headers, payload: {} })
      assert.equal(contagem.statusCode, 201)
    }
    for (const sortBy of schema.shape.sortBy.unwrap().options) {
      for (const sortOrder of ['asc', 'desc']) {
        const resposta = await ctx.app.inject({ url: `/api${rota}?page=1&pageSize=5&sortBy=${sortBy}&sortOrder=${sortOrder}`, headers })
        assert.equal(resposta.statusCode, 200, `${sortBy} ${sortOrder}: ${resposta.body}`)
        assert.ok(Array.isArray(resposta.json().data))
      }
    }
    for (const query of ['page=0', 'pageSize=101', 'sortOrder=invalido', 'sortBy=inexistente']) {
      const resposta = await ctx.app.inject({ url: `/api${rota}?${query}`, headers })
      assert.equal(resposta.statusCode, 422, `${query}: ${resposta.body}`)
    }
  })
}
