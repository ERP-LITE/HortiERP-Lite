import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { eq, inArray, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { db, pool } from '../src/db/client.js'
import {
  categories,
  companies,
  losses,
  products,
  stockEntries,
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

describe('buscas, paginação e integridade', () => {
  test('busca entradas por fornecedor e pelo nome do item', async () => {
    const tenant = await createTenant('entry-search')
    await createStockEntry(tenant.companyId, tenant.operator.id, {
      supplierName: 'Fornecedor Especial',
      items: [{ productId: tenant.productId, quantity: 2 }],
    })

    for (const search of ['Especial', 'Produto entry-search']) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/stock-entries?page=1&pageSize=15&search=${encodeURIComponent(search)}`,
        headers: { cookie: authCookie(tenant.operator) },
      })
      assert.equal(response.statusCode, 200)
      assert.equal(response.json<{ total: number }>().total, 1)
    }
  })

  test('produto de outra empresa não pode ser usado em entrada nem perda', async () => {
    const tenantA = await createTenant('operation-a', '10')
    const tenantB = await createTenant('operation-b', '10')

    const entryResponse = await app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie: authCookie(tenantA.operator) },
      payload: { items: [{ productId: tenantB.productId, quantity: 1 }] },
    })
    assert.equal(entryResponse.statusCode, 404)

    const lossResponse = await app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie: authCookie(tenantA.operator) },
      payload: { productId: tenantB.productId, quantity: 1, reason: 'avariado' },
    })
    assert.equal(lossResponse.statusCode, 404)

    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(stockEntries)
    assert.equal(Number(total), 0)
  })

  test('índice único impede duplicidade simultânea e retorna conflito amigável', async () => {
    const tenant = await createTenant('duplicate')
    const request = (name: string) =>
      app.inject({
        method: 'POST',
        url: '/api/categories',
        headers: { cookie: authCookie(tenant.admin) },
        payload: { name },
      })

    const responses = await Promise.all([request('Nova categoria'), request('NOVA CATEGORIA')])
    assert.deepEqual(responses.map(({ statusCode }) => statusCode).sort(), [201, 409])
  })

  test('relatórios são paginados e não exibem categoria excluída', async () => {
    const tenant = await createTenant('reports')
    await db.update(categories).set({ deletedAt: new Date() }).where(eq(categories.id, tenant.categoryId))

    const categoryReport = await app.inject({
      method: 'GET',
      url: '/api/reports/stock-by-category',
      headers: { cookie: authCookie(tenant.admin) },
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
    const entriesReport = await app.inject({
      method: 'GET',
      url: '/api/reports/stock-entries?page=1&pageSize=1',
      headers: { cookie: authCookie(tenant.admin) },
    })
    const report = entriesReport.json<{ data: unknown[]; total: number; totalPages: number }>()
    assert.equal(entriesReport.statusCode, 200)
    assert.equal(report.data.length, 1)
    assert.equal(report.total, 2)
    assert.equal(report.totalPages, 2)
  })
})

describe('ajuste manual de estoque', () => {
  test('operador não pode ajustar estoque (exige admin ou gerente)', async () => {
    const tenant = await createTenant('adjust-role', '10')

    const response = await app.inject({
      method: 'POST',
      url: '/api/stock/adjust',
      headers: { cookie: authCookie(tenant.operator) },
      payload: { productId: tenant.productId, quantity: 7, notes: 'Contagem física' },
    })

    assert.equal(response.statusCode, 403)
  })

  test('admin ajusta o estoque, gera movimento tipo ajuste com o motivo e delta corretos', async () => {
    const tenant = await createTenant('adjust-ok', '10')

    const response = await app.inject({
      method: 'POST',
      url: '/api/stock/adjust',
      headers: { cookie: authCookie(tenant.admin) },
      payload: { productId: tenant.productId, quantity: 7, notes: 'Contagem física apontou divergência' },
    })

    assert.equal(response.statusCode, 201)
    const movement = response.json<{ type: string; quantity: string; balanceAfter: string; notes: string }>()
    assert.equal(movement.type, 'ajuste')
    assert.equal(Number(movement.quantity), -3)
    assert.equal(Number(movement.balanceAfter), 7)
    assert.equal(movement.notes, 'Contagem física apontou divergência')

    const [product] = await db.select({ currentStock: products.currentStock }).from(products).where(eq(products.id, tenant.productId))
    assert.equal(Number(product.currentStock), 7)
  })

  test('rejeita ajuste para a mesma quantidade já registrada', async () => {
    const tenant = await createTenant('adjust-noop', '10')

    const response = await app.inject({
      method: 'POST',
      url: '/api/stock/adjust',
      headers: { cookie: authCookie(tenant.admin) },
      payload: { productId: tenant.productId, quantity: 10, notes: 'Sem mudança' },
    })

    assert.equal(response.statusCode, 422)
  })

  test('produto de outra empresa retorna 404 no ajuste', async () => {
    const tenantA = await createTenant('adjust-a', '10')
    const tenantB = await createTenant('adjust-b', '10')

    const response = await app.inject({
      method: 'POST',
      url: '/api/stock/adjust',
      headers: { cookie: authCookie(tenantA.admin) },
      payload: { productId: tenantB.productId, quantity: 5, notes: 'Tentativa cross-tenant' },
    })

    assert.equal(response.statusCode, 404)
  })
})

describe('exclusão lógica (soft delete genérico)', () => {
  test('exclui categoria individualmente e marca deletedAt/updatedBy', async () => {
    const tenant = await createTenant('delete-cat')

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/categories/${tenant.categoryId}`,
      headers: { cookie: authCookie(tenant.admin) },
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

    const response = await app.inject({
      method: 'POST',
      url: '/api/categories/bulk-delete',
      headers: { cookie: authCookie(tenant.admin) },
      payload: { ids: [tenant.categoryId, extra.id] },
    })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { deleted: 2 })
  })

  test('exclui usuário individualmente e também desativa (softDelete com extraSet)', async () => {
    const tenant = await createTenant('delete-user')

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/users/${tenant.operator.id}`,
      headers: { cookie: authCookie(tenant.admin) },
    })
    assert.equal(response.statusCode, 204)

    const [user] = await db.select().from(users).where(eq(users.id, tenant.operator.id))
    assert.ok(user.deletedAt)
    assert.equal(user.active, false)
  })

  test('exclui usuários em lote e também desativa (softDelete com extraSet)', async () => {
    const tenant = await createTenant('delete-user-bulk')

    const response = await app.inject({
      method: 'POST',
      url: '/api/users/bulk-delete',
      headers: { cookie: authCookie(tenant.admin) },
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
