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

describe('cadastro de empresas', () => {
  async function superAdminFixture(suffix: string) {
    const [platform] = await db.insert(companies).values({ name: 'Plataforma' }).returning({ id: companies.id })
    return createUser(platform.id, 'super_admin', suffix)
  }

  const companyPayload = {
    name: 'Mercado da Praça',
    legalName: 'Mercado da Praça Ltda',
    document: '11.222.333/0001-81',
    stateRegistration: '123456789',
    contactName: 'Maria Silva',
    contactEmail: 'contato@mercadodapraca.test',
    phone: '(11) 99999-8888',
    postalCode: '01001-000',
    street: 'Praça da Sé',
    addressNumber: '100',
    complement: 'Loja 2',
    district: 'Sé',
    city: 'São Paulo',
    state: 'sp',
    adminName: 'Administradora',
    adminEmail: 'admin@mercadodapraca.test',
    adminPassword: 'senha-forte-123',
  }

  test('cria empresa com identificação, contato e endereço normalizados', async () => {
    const superAdmin = await superAdminFixture('company-create')
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/companies',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: companyPayload,
    })

    assert.equal(response.statusCode, 201)
    const result = response.json<{ company: { document: string; phone: string; postalCode: string; state: string } }>()
    assert.equal(result.company.document, '11222333000181')
    assert.equal(result.company.phone, '11999998888')
    assert.equal(result.company.postalCode, '01001000')
    assert.equal(result.company.state, 'SP')
  })

  test('rejeita CNPJ inválido e impede CNPJ duplicado', async () => {
    const superAdmin = await superAdminFixture('company-validation')
    const invalid = await ctx.app.inject({
      method: 'POST',
      url: '/api/companies',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: { ...companyPayload, document: '11.111.111/1111-11' },
    })
    assert.equal(invalid.statusCode, 422)

    const first = await ctx.app.inject({
      method: 'POST',
      url: '/api/companies',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: companyPayload,
    })
    assert.equal(first.statusCode, 201)

    const duplicate = await ctx.app.inject({
      method: 'POST',
      url: '/api/companies',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: { ...companyPayload, adminEmail: 'outro-admin@test.local' },
    })
    assert.equal(duplicate.statusCode, 409)
    assert.match(duplicate.body, /CNPJ/)
  })
})
