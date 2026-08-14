import { after, before, beforeEach } from 'node:test'
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { db, pool } from '../src/db/client.js'
import { categories, companies, products, units, users } from '../src/db/schema/index.js'

export type Role = 'admin' | 'gerente' | 'operador' | 'super_admin'

export interface FixtureUser {
  id: string
  companyId: string
  name: string
  role: Role
}

export interface TenantFixture {
  companyId: string
  admin: FixtureUser
  manager: FixtureUser
  operator: FixtureUser
  categoryId: string
  unitId: string
  productId: string
}

export function assertTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL é obrigatória para os testes')

  const databaseName = new URL(databaseUrl).pathname.slice(1)
  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error(`Execução recusada: o banco "${databaseName}" não está identificado como banco de teste`)
  }
}

export async function createUser(companyId: string, role: Role, suffix: string): Promise<FixtureUser> {
  const [user] = await db
    .insert(users)
    .values({
      companyId,
      name: `${role}-${suffix}`,
      email: `${role}-${suffix}@test.local`,
      passwordHash: 'not-used-by-integration-tests',
      role,
    })
    .returning({ id: users.id, companyId: users.companyId, name: users.name, role: users.role })

  return user
}

export async function createTenant(suffix: string, initialStock = '0'): Promise<TenantFixture> {
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

/**
 * Registra os hooks before/beforeEach/after comuns a todo arquivo de teste
 * (sobe o app uma vez, trunca as tabelas entre testes, fecha app+pool no final)
 * e devolve um objeto que expõe a instância do app assim que `before` terminar.
 */
export function setupTestApp(options: { systemLogs?: boolean } = {}) {
  const ctx: { app: FastifyInstance } = { app: undefined as unknown as FastifyInstance }

  before(async () => {
    assertTestDatabase()
    // O hook de log fica desligado por padrão (ruído em toda requisição de teste);
    // quem testa o próprio hook liga explicitamente.
    ctx.app = buildApp({ systemLogs: options.systemLogs ?? false })
    await ctx.app.ready()
  })

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE ${companies} CASCADE`)
  })

  after(async () => {
    await ctx.app.close()
    await pool.end()
  })

  return ctx
}

export function authCookie(
  app: FastifyInstance,
  user: FixtureUser,
  options?: { companyId?: string; realCompanyId?: string; role?: Role },
) {
  const token = app.jwt.sign({
    sub: user.id,
    companyId: options?.companyId ?? user.companyId,
    role: options?.role ?? user.role,
    ...(options?.realCompanyId ? { realCompanyId: options.realCompanyId } : {}),
  })
  return `token=${token}`
}
