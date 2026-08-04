import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { categories, users } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

describe('índices únicos e concorrência de cadastro', () => {
  test('índice único impede duplicidade simultânea e retorna conflito amigável', async () => {
    const tenant = await createTenant('duplicate')
    const request = (name: string) =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/categories',
        headers: { cookie: authCookie(ctx.app, tenant.admin) },
        payload: { name },
      })

    const responses = await Promise.all([request('Nova categoria'), request('NOVA CATEGORIA')])
    assert.deepEqual(responses.map(({ statusCode }) => statusCode).sort(), [201, 409])
  })
})

describe('exclusão lógica (soft delete genérico)', () => {
  test('exclui categoria individualmente e marca deletedAt/updatedBy', async () => {
    const tenant = await createTenant('delete-cat')

    const response = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/categories/${tenant.categoryId}`,
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })
    assert.equal(response.statusCode, 204)

    const [category] = await db.select().from(categories).where(eq(categories.id, tenant.categoryId))
    assert.ok(category.deletedAt)
    assert.equal(category.updatedBy, tenant.admin.id)
  })

  test('exclui categorias em lote', async () => {
    const tenant = await createTenant('delete-cat-bulk')
    const [extra] = await db
      .insert(categories)
      .values({ companyId: tenant.companyId, name: 'Extra delete-cat-bulk', createdBy: tenant.admin.id })
      .returning({ id: categories.id })

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/categories/bulk-delete',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { ids: [tenant.categoryId, extra.id] },
    })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { deleted: 2 })
  })

  test('exclui usuário individualmente e também desativa (softDelete com extraSet)', async () => {
    const tenant = await createTenant('delete-user')

    const response = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/users/${tenant.operator.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })
    assert.equal(response.statusCode, 204)

    const [user] = await db.select().from(users).where(eq(users.id, tenant.operator.id))
    assert.ok(user.deletedAt)
    assert.equal(user.active, false)
  })

  test('exclui usuários em lote e também desativa (softDelete com extraSet)', async () => {
    const tenant = await createTenant('delete-user-bulk')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/users/bulk-delete',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { ids: [tenant.operator.id, tenant.manager.id] },
    })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { deleted: 2 })

    const rows = await db
      .select({ active: users.active, deletedAt: users.deletedAt })
      .from(users)
      .where(inArray(users.id, [tenant.operator.id, tenant.manager.id]))
    assert.equal(rows.length, 2)
    for (const row of rows) {
      assert.ok(row.deletedAt)
      assert.equal(row.active, false)
    }
  })
})
