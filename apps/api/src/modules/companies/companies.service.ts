import bcrypt from 'bcryptjs'
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { companies, users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { assertUniqueField } from '../../shared/db/assertUniqueField.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import type { CreateCompanyInput, ListCompaniesQuery, UpdateCompanyInput } from './companies.schema.js'

function assertUniqueAdminEmail(email: string) {
  return assertUniqueField({
    table: users,
    idColumn: users.id,
    valueColumn: users.email,
    value: email,
    field: 'adminEmail',
    message: 'Já existe um usuário com esse e-mail',
  })
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === '23505'
}

export async function listCompanies(query: ListCompaniesQuery) {
  const conditions = [isNull(companies.deletedAt)]
  if (query.search) {
    conditions.push(or(ilike(companies.name, `%${query.search}%`), ilike(companies.document, `%${query.search}%`))!)
  }
  const where = and(...conditions)

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(where)
      .orderBy(asc(companies.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(companies).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function getCompany(id: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), isNull(companies.deletedAt)))

  if (!company) throw AppError.notFound('Empresa não encontrada')

  return company
}

export async function createCompanyWithAdmin(data: CreateCompanyInput) {
  await assertUniqueAdminEmail(data.adminEmail)

  const passwordHash = await bcrypt.hash(data.adminPassword, 10)

  try {
    return await db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companies)
        .values({ name: data.name, document: data.document })
        .returning()

      const [admin] = await tx
        .insert(users)
        .values({
          companyId: company.id,
          name: data.adminName,
          email: data.adminEmail,
          passwordHash,
          role: 'admin',
        })
        .returning()

      return {
        company,
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
      }
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw AppError.duplicate('adminEmail', 'Já existe um usuário com esse e-mail')
    throw error
  }
}

export async function assertCompanyAccessible(companyId: string) {
  const company = await getCompany(companyId)

  if (!company.active) {
    throw AppError.conflict('Empresa está suspensa. Reative antes de acessar.')
  }

  return company
}

export async function updateCompany(id: string, data: UpdateCompanyInput) {
  await getCompany(id)

  const [company] = await db
    .update(companies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning()

  return company
}

export async function setCompanyActive(id: string, active: boolean) {
  await getCompany(id)

  const [company] = await db
    .update(companies)
    .set({ active, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning()

  return company
}
