import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { companies } from '../src/db/schema/index.js'
import { authCookie, createTenant, createUser, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

describe('impersonação', () => {
  test('super_admin acessa empresa ativa e perde a sessão quando ela é suspensa', async () => {
    const target = await createTenant('impersonated')
    const [platform] = await db.insert(companies).values({ name: 'Plataforma' }).returning({ id: companies.id })
    const superAdmin = await createUser(platform.id, 'super_admin', 'platform')

    const impersonateResponse = await ctx.app.inject({
      method: 'POST',
      url: `/api/companies/${target.companyId}/impersonate`,
      headers: { cookie: authCookie(ctx.app, superAdmin) },
    })
    assert.equal(impersonateResponse.statusCode, 200)
    const impersonationCookie = impersonateResponse.cookies.find(({ name }) => name === 'token')
    assert.ok(impersonationCookie)

    const activeResponse = await ctx.app.inject({
      method: 'GET',
      url: '/api/categories?page=1&pageSize=30',
      headers: { cookie: `token=${impersonationCookie.value}` },
    })
    assert.equal(activeResponse.statusCode, 200)

    await db.update(companies).set({ active: false }).where(eq(companies.id, target.companyId))

    const suspendedResponse = await ctx.app.inject({
      method: 'GET',
      url: '/api/categories?page=1&pageSize=30',
      headers: { cookie: `token=${impersonationCookie.value}` },
    })
    assert.equal(suspendedResponse.statusCode, 401)
  })
})
