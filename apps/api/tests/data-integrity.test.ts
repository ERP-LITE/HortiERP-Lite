import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq, inArray } from 'drizzle-orm'
import { db } from './db.js'
import { categories, units, users } from '../src/db/schema/index.js'
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

describe('cadastro em uso por produto não pode ser excluído', () => {
  test('categoria usada por produto é recusada, individual e em lote', async () => {
    const tenant = await createTenant('cat-em-uso')
    const cookie = authCookie(ctx.app, tenant.admin)

    const individual = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/categories/${tenant.categoryId}`,
      headers: { cookie },
    })
    assert.equal(individual.statusCode, 409)
    assert.match(individual.body, /1 produto\(s\) usam esta categoria/)

    const lote = await ctx.app.inject({
      method: 'POST',
      url: '/api/categories/bulk-delete',
      headers: { cookie },
      payload: { ids: [tenant.categoryId] },
    })
    assert.equal(lote.statusCode, 409)

    const [category] = await db.select().from(categories).where(eq(categories.id, tenant.categoryId))
    assert.equal(category.deletedAt, null)
  })

  test('unidade usada por produto é recusada, individual e em lote', async () => {
    const tenant = await createTenant('un-em-uso')
    const cookie = authCookie(ctx.app, tenant.admin)

    const individual = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/units/${tenant.unitId}`,
      headers: { cookie },
    })
    assert.equal(individual.statusCode, 409)
    assert.match(individual.body, /1 produto\(s\) usam esta unidade/)

    const lote = await ctx.app.inject({
      method: 'POST',
      url: '/api/units/bulk-delete',
      headers: { cookie },
      payload: { ids: [tenant.unitId] },
    })
    assert.equal(lote.statusCode, 409)

    const [unit] = await db.select().from(units).where(eq(units.id, tenant.unitId))
    assert.equal(unit.deletedAt, null)
  })

  test('unidade sem produto continua excluível', async () => {
    const tenant = await createTenant('un-livre')
    const [livre] = await db
      .insert(units)
      .values({
        companyId: tenant.companyId,
        name: 'Engradado un-livre',
        abbreviation: 'engr',
        createdBy: tenant.admin.id,
      })
      .returning({ id: units.id })

    const response = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/units/${livre.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })
    assert.equal(response.statusCode, 204)
  })
})

describe('exclusão lógica (soft delete genérico)', () => {
  test('exclui categoria individualmente e marca deletedAt/updatedBy', async () => {
    const tenant = await createTenant('delete-cat')
    const [semProduto] = await db
      .insert(categories)
      .values({ companyId: tenant.companyId, name: 'Sem produto delete-cat', createdBy: tenant.admin.id })
      .returning({ id: categories.id })

    const response = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/categories/${semProduto.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })
    assert.equal(response.statusCode, 204)

    const [category] = await db.select().from(categories).where(eq(categories.id, semProduto.id))
    assert.ok(category.deletedAt)
    assert.equal(category.updatedBy, tenant.admin.id)
  })

  test('exclui categorias em lote', async () => {
    const tenant = await createTenant('delete-cat-bulk')
    const extras = await db
      .insert(categories)
      .values([
        { companyId: tenant.companyId, name: 'Extra 1 delete-cat-bulk', createdBy: tenant.admin.id },
        { companyId: tenant.companyId, name: 'Extra 2 delete-cat-bulk', createdBy: tenant.admin.id },
      ])
      .returning({ id: categories.id })

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/categories/bulk-delete',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { ids: extras.map(({ id }) => id) },
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
