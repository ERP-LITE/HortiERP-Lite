import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { categories } from '../src/db/schema/index.js'
import { createStockEntry } from './servicos.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

describe('relatórios', () => {
  test('relatórios são paginados e não exibem categoria excluída', async () => {
    const tenant = await createTenant('reports')
    await db.update(categories).set({ deletedAt: new Date() }).where(eq(categories.id, tenant.categoryId))

    const categoryReport = await ctx.app.inject({
      method: 'GET',
      url: '/api/reports/stock-by-category',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })
    assert.equal(categoryReport.statusCode, 200)
    assert.deepEqual(categoryReport.json(), [])

    await db.update(categories).set({ deletedAt: null }).where(eq(categories.id, tenant.categoryId))
    await createStockEntry(tenant.companyId, tenant.operator.id, {
      items: [{ productId: tenant.productId, quantity: 1 }],
    })
    await createStockEntry(tenant.companyId, tenant.operator.id, {
      items: [{ productId: tenant.productId, quantity: 1 }],
    })
    const entriesReport = await ctx.app.inject({
      method: 'GET',
      url: '/api/reports/stock-entries?page=1&pageSize=1',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })
    const report = entriesReport.json<{ data: unknown[]; total: number; totalPages: number }>()
    assert.equal(entriesReport.statusCode, 200)
    assert.equal(report.data.length, 1)
    assert.equal(report.total, 2)
    assert.equal(report.totalPages, 2)
  })
})
