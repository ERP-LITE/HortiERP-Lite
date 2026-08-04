import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { companies, users } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

describe('isolamento multiempresa e permissões', () => {
  test('uma empresa não lista nem acessa categorias de outra empresa', async () => {
    const tenantA = await createTenant('a')
    const tenantB = await createTenant('b')

    const listResponse = await ctx.app.inject({
      method: 'GET',
      url: '/api/categories?page=1&pageSize=30',
      headers: { cookie: authCookie(ctx.app, tenantA.admin) },
    })
    assert.equal(listResponse.statusCode, 200)
    const list = listResponse.json<{ data: Array<{ id: string }>; total: number }>()
    assert.equal(list.total, 1)
    assert.deepEqual(list.data.map(({ id }) => id), [tenantA.categoryId])

    const foreignResponse = await ctx.app.inject({
      method: 'GET',
      url: `/api/categories/${tenantB.categoryId}`,
      headers: { cookie: authCookie(ctx.app, tenantA.admin) },
    })
    assert.equal(foreignResponse.statusCode, 404)
  })

  test('operador não escreve cadastro e gerente pode criar categoria', async () => {
    const tenant = await createTenant('roles')

    const denied = await ctx.app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { name: 'Negada' },
    })
    assert.equal(denied.statusCode, 403)

    const allowed = await ctx.app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { cookie: authCookie(ctx.app, tenant.manager) },
      payload: { name: 'Permitida' },
    })
    assert.equal(allowed.statusCode, 201)
  })
})

describe('invalidação imediata de sessão', () => {
  test('usuário desativado recebe 401 com JWT ainda válido', async () => {
    const tenant = await createTenant('disabled-user')
    const cookie = authCookie(ctx.app, tenant.admin)
    await db.update(users).set({ active: false }).where(eq(users.id, tenant.admin.id))

    const response = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    assert.equal(response.statusCode, 401)
  })

  test('empresa suspensa invalida imediatamente as sessões existentes', async () => {
    const tenant = await createTenant('disabled-company')
    const cookie = authCookie(ctx.app, tenant.admin)
    await db.update(companies).set({ active: false }).where(eq(companies.id, tenant.companyId))

    const response = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    assert.equal(response.statusCode, 401)
  })

  test('mudança de papel invalida o JWT com permissão antiga', async () => {
    const tenant = await createTenant('changed-role')
    const cookie = authCookie(ctx.app, tenant.admin)
    await db.update(users).set({ role: 'operador' }).where(eq(users.id, tenant.admin.id))

    const response = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    assert.equal(response.statusCode, 401)
  })
})
