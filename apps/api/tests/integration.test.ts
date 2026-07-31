import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { db, pool } from '../src/db/client.js'
import {
  categories,
  companies,
  losses,
  products,
  stockMovements,
  units,
  users,
} from '../src/db/schema/index.js'
import { createLoss } from '../src/modules/losses/losses.service.js'
import { createStockEntry } from '../src/modules/stock-entries/stock-entries.service.js'

type Role = 'admin' | 'gerente' | 'operador' | 'super_admin'

interface FixtureUser {
  id: string
  companyId: string
  role: Role
}

interface TenantFixture {
  companyId: string
  admin: FixtureUser
  manager: FixtureUser
  operator: FixtureUser
  categoryId: string
  unitId: string
  productId: string
}

let app: FastifyInstance

function assertTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL é obrigatória para os testes')

  const databaseName = new URL(databaseUrl).pathname.slice(1)
  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error(`Execução recusada: o banco "${databaseName}" não está identificado como banco de teste`)
  }
}

async function createUser(companyId: string, role: Role, suffix: string): Promise<FixtureUser> {
  const [user] = await db
    .insert(users)
    .values({
      companyId,
      name: `${role}-${suffix}`,
      email: `${role}-${suffix}@test.local`,
      passwordHash: 'not-used-by-integration-tests',
      role,
    })
    .returning({ id: users.id, companyId: users.companyId, role: users.role })

  return user
}

async function createTenant(suffix: string, initialStock = '0'): Promise<TenantFixture> {
  const [company] = await db.insert(companies).values({ name: `Empresa ${suffix}` }).returning({ id: companies.id })
  const admin = await createUser(company.id, 'admin', suffix)
  const manager = await createUser(company.id, 'gerente', suffix)
  const operator = await createUser(company.id, 'operador', suffix)
  const [category] = await db
    .insert(categories)
    .values({ companyId: company.id, name: `Categoria ${suffix}`, createdBy: admin.id })
    .returning({ id: categories.id })
  const [unit] = await db
    .insert(units)
    .values({ companyId: company.id, name: `Unidade ${suffix}`, abbreviation: `u${suffix}`, createdBy: admin.id })
    .returning({ id: units.id })
  const [product] = await db
    .insert(products)
    .values({
      companyId: company.id,
      categoryId: category.id,
      unitId: unit.id,
      name: `Produto ${suffix}`,
      currentStock: initialStock,
      createdBy: admin.id,
    })
    .returning({ id: products.id })

  return {
    companyId: company.id,
    admin,
    manager,
    operator,
    categoryId: category.id,
    unitId: unit.id,
    productId: product.id,
  }
}

function authCookie(user: FixtureUser, options?: { companyId?: string; realCompanyId?: string; role?: Role }) {
  const token = app.jwt.sign({
    sub: user.id,
    companyId: options?.companyId ?? user.companyId,
    role: options?.role ?? user.role,
    ...(options?.realCompanyId ? { realCompanyId: options.realCompanyId } : {}),
  })
  return `token=${token}`
}

before(async () => {
  assertTestDatabase()
  app = buildApp({ systemLogs: false })
  await app.ready()
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ${companies} CASCADE`)
})

after(async () => {
  await app.close()
  await pool.end()
})

describe('isolamento multiempresa e permissões', () => {
  test('uma empresa não lista nem acessa categorias de outra empresa', async () => {
    const tenantA = await createTenant('a')
    const tenantB = await createTenant('b')

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/categories?page=1&pageSize=30',
      headers: { cookie: authCookie(tenantA.admin) },
    })
    assert.equal(listResponse.statusCode, 200)
    const list = listResponse.json<{ data: Array<{ id: string }>; total: number }>()
    assert.equal(list.total, 1)
    assert.deepEqual(list.data.map(({ id }) => id), [tenantA.categoryId])

    const foreignResponse = await app.inject({
      method: 'GET',
      url: `/api/categories/${tenantB.categoryId}`,
      headers: { cookie: authCookie(tenantA.admin) },
    })
    assert.equal(foreignResponse.statusCode, 404)
  })

  test('operador não escreve cadastro e gerente pode criar categoria', async () => {
    const tenant = await createTenant('roles')

    const denied = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { cookie: authCookie(tenant.operator) },
      payload: { name: 'Negada' },
    })
    assert.equal(denied.statusCode, 403)

    const allowed = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { cookie: authCookie(tenant.manager) },
      payload: { name: 'Permitida' },
    })
    assert.equal(allowed.statusCode, 201)
  })
})

describe('invalidação imediata de sessão', () => {
  test('usuário desativado recebe 401 com JWT ainda válido', async () => {
    const tenant = await createTenant('disabled-user')
    const cookie = authCookie(tenant.admin)
    await db.update(users).set({ active: false }).where(eq(users.id, tenant.admin.id))

    const response = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    assert.equal(response.statusCode, 401)
  })

  test('empresa suspensa invalida imediatamente as sessões existentes', async () => {
    const tenant = await createTenant('disabled-company')
    const cookie = authCookie(tenant.admin)
    await db.update(companies).set({ active: false }).where(eq(companies.id, tenant.companyId))

    const response = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    assert.equal(response.statusCode, 401)
  })

  test('mudança de papel invalida o JWT com permissão antiga', async () => {
    const tenant = await createTenant('changed-role')
    const cookie = authCookie(tenant.admin)
    await db.update(users).set({ role: 'operador' }).where(eq(users.id, tenant.admin.id))

    const response = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    assert.equal(response.statusCode, 401)
  })
})

describe('concorrência de estoque', () => {
  test('entradas simultâneas acumulam todas as quantidades sem perder atualização', async () => {
    const tenant = await createTenant('entries', '0')

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        createStockEntry(tenant.companyId, tenant.operator.id, {
          supplierName: `Fornecedor ${index}`,
          items: [{ productId: tenant.productId, quantity: 1 }],
        }),
      ),
    )

    const [product] = await db
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, tenant.productId))
    assert.equal(product.currentStock, '20.000')

    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.productId, tenant.productId))
    assert.equal(movements.length, 20)
  })

  test('perdas simultâneas nunca deixam estoque negativo', async () => {
    const tenant = await createTenant('losses', '10')

    const results = await Promise.allSettled([
      createLoss(tenant.companyId, tenant.operator.id, {
        productId: tenant.productId,
        quantity: 7,
        reason: 'avariado',
      }),
      createLoss(tenant.companyId, tenant.operator.id, {
        productId: tenant.productId,
        quantity: 7,
        reason: 'avariado',
      }),
    ])

    assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
    assert.equal(results.filter(({ status }) => status === 'rejected').length, 1)

    const [product] = await db
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, tenant.productId))
    assert.equal(product.currentStock, '3.000')

    const persistedLosses = await db.select().from(losses).where(eq(losses.productId, tenant.productId))
    assert.equal(persistedLosses.length, 1)
  })
})

describe('impersonação', () => {
  test('super_admin acessa empresa ativa e perde a sessão quando ela é suspensa', async () => {
    const target = await createTenant('impersonated')
    const [platform] = await db.insert(companies).values({ name: 'Plataforma' }).returning({ id: companies.id })
    const superAdmin = await createUser(platform.id, 'super_admin', 'platform')

    const impersonateResponse = await app.inject({
      method: 'POST',
      url: `/api/companies/${target.companyId}/impersonate`,
      headers: { cookie: authCookie(superAdmin) },
    })
    assert.equal(impersonateResponse.statusCode, 200)
    const impersonationCookie = impersonateResponse.cookies.find(({ name }) => name === 'token')
    assert.ok(impersonationCookie)

    const activeResponse = await app.inject({
      method: 'GET',
      url: '/api/categories?page=1&pageSize=30',
      headers: { cookie: `token=${impersonationCookie.value}` },
    })
    assert.equal(activeResponse.statusCode, 200)

    await db.update(companies).set({ active: false }).where(eq(companies.id, target.companyId))

    const suspendedResponse = await app.inject({
      method: 'GET',
      url: '/api/categories?page=1&pageSize=30',
      headers: { cookie: `token=${impersonationCookie.value}` },
    })
    assert.equal(suspendedResponse.statusCode, 401)
  })
})
