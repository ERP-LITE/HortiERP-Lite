import bcrypt from 'bcryptjs'
import { and, asc, count, eq, ilike, isNull, notInArray, or } from 'drizzle-orm'
import { orderByColumn } from '../../shared/db/sorting.js'
import { db } from '../../db/client.js'
import { companies, users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { assertUniqueField } from '../../shared/db/assertUniqueField.js'
import { assertUniqueUserEmail } from '../../shared/db/userPublicColumns.js'
import { UNIQUE_CONSTRAINTS, uniqueViolationConstraint } from '../../shared/db/uniqueConstraints.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import type { CreateCompanyInput, ListCompaniesQuery, UpdateCompanyInput } from './companies.schema.js'

function assertUniqueCompanyDocument(document: string, excludeId?: string) {
  return assertUniqueField({
    table: companies,
    idColumn: companies.id,
    valueColumn: companies.document,
    value: document,
    field: 'document',
    message: 'Já existe uma empresa com esse CNPJ',
    deletedAtColumn: companies.deletedAt,
    excludeId,
  })
}

function platformCompanyIdsSubquery() {
  return db.select({ id: users.companyId }).from(users).where(eq(users.role, 'super_admin'))
}

export async function isPlatformCompany(companyId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, 'super_admin')))
    .limit(1)

  return Boolean(row)
}

export async function listCompanies(query: ListCompaniesQuery) {
  const conditions = [isNull(companies.deletedAt), notInArray(companies.id, platformCompanyIdsSubquery())]
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(
      or(
        ilike(companies.name, term),
        ilike(companies.legalName, term),
        ilike(companies.document, term),
        ilike(companies.contactEmail, term),
      )!,
    )
  }
  const where = and(...conditions)
  const orderBy = orderByColumn(query.sortBy ? companies[query.sortBy] : companies.name, query.sortOrder)

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(where)
      .orderBy(orderBy, asc(companies.name))
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
  await Promise.all([
    assertUniqueUserEmail(data.adminEmail, { field: 'adminEmail' }),
    assertUniqueCompanyDocument(data.document),
  ])

  const passwordHash = await bcrypt.hash(data.adminPassword, 10)

  try {
    return await db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companies)
        .values({
          name: data.name,
          legalName: data.legalName,
          document: data.document,
          stateRegistration: data.stateRegistration,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          phone: data.phone,
          postalCode: data.postalCode,
          street: data.street,
          addressNumber: data.addressNumber,
          complement: data.complement,
          district: data.district,
          city: data.city,
          state: data.state,
        })
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
    const constraint = uniqueViolationConstraint(error)
    if (constraint !== undefined) {
      const duplicate =
        constraint === 'companies_document_active_unique'
          ? UNIQUE_CONSTRAINTS.companies_document_active_unique
          : UNIQUE_CONSTRAINTS.users_email_active_unique
      const field = constraint === 'companies_document_active_unique' ? 'document' : 'adminEmail'
      throw AppError.duplicate(field, duplicate.message)
    }
    throw error
  }
}

export async function assertCompanyAccessible(companyId: string) {
  const company = await getCompany(companyId)

  if (!company.active) {
    throw AppError.conflict('Empresa está suspensa. Reative antes de acessar.')
  }

  if (await isPlatformCompany(companyId)) {
    throw AppError.forbidden('A empresa da plataforma não pode ser acessada como suporte')
  }

  return company
}

export async function updateCompany(id: string, data: UpdateCompanyInput) {
  await getCompany(id)
  if (data.document) await assertUniqueCompanyDocument(data.document, id)

  const [company] = await db
    .update(companies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning()

  return company
}

export async function setCompanyActive(id: string, active: boolean) {
  await getCompany(id)

  if (await isPlatformCompany(id)) {
    throw AppError.forbidden('Não é possível suspender a empresa da plataforma')
  }

  const [company] = await db
    .update(companies)
    .set({ active, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning()

  return company
}
