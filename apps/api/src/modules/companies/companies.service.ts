import bcrypt from 'bcryptjs'
import { and, asc, count, eq, ilike, isNull, notInArray, or } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { orderByColumn } from '../../shared/db/sorting.js'
import { db } from '../../db/client.js'
import { companies, users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { assertUniqueField } from '../../shared/db/assertUniqueField.js'
import { assertUniqueUserEmail } from '../../shared/db/userPublicColumns.js'
import {
  UNIQUE_CONSTRAINTS,
  uniqueViolationConstraint,
  type UniqueConstraintName,
} from '../../shared/db/uniqueConstraints.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import type { CreateCompanyInput, ListCompaniesQuery, UpdateCompanyInput } from './companies.schema.js'

/**
 * Campos que não podem se repetir entre empresas não excluídas. Telefone, nome do contato e endereço
 * ficam de fora por decisão, não por esquecimento: ver docs/decisoes-arquiteturais.md.
 *
 * Acrescentar um campo aqui exige o índice correspondente na migração, e vice-versa.
 */
const CAMPOS_UNICOS_DA_EMPRESA = [
  { campo: 'name', coluna: companies.name, constraint: 'companies_name_active_unique' },
  { campo: 'legalName', coluna: companies.legalName, constraint: 'companies_legal_name_active_unique' },
  { campo: 'document', coluna: companies.document, constraint: 'companies_document_active_unique' },
  {
    campo: 'stateRegistration',
    coluna: companies.stateRegistration,
    constraint: 'companies_state_registration_active_unique',
    // "Isento" e "Não contribuinte" são a ausência de inscrição escrita por extenso, e são comuns:
    // compará-las como número registrado recusaria a segunda empresa isenta que aparecesse.
    valeSomenteSe: (valor: string) => /[0-9]/.test(valor),
  },
  { campo: 'contactEmail', coluna: companies.contactEmail, constraint: 'companies_contact_email_active_unique' },
] as const satisfies ReadonlyArray<{
  campo: keyof CreateCompanyInput
  coluna: PgColumn
  constraint: UniqueConstraintName
  valeSomenteSe?: (valor: string) => boolean
}>

type CamposDaEmpresa = Partial<Record<(typeof CAMPOS_UNICOS_DA_EMPRESA)[number]['campo'], string | undefined>>

/**
 * `allSettled` e não `all`: com `all`, quem colasse o cadastro inteiro de outra empresa veria um erro
 * por vez, em ordem imprevisível, e teria que enviar quatro vezes.
 */
async function assertEmpresaSemDuplicata(dados: CamposDaEmpresa, excludeId?: string) {
  const aVerificar = CAMPOS_UNICOS_DA_EMPRESA.filter((item) => {
    const valor = dados[item.campo]
    if (!valor) return false
    return 'valeSomenteSe' in item ? item.valeSomenteSe(valor) : true
  })

  const resultados = await Promise.allSettled(
    aVerificar.map((item) =>
      assertUniqueField({
        table: companies,
        idColumn: companies.id,
        valueColumn: item.coluna,
        value: dados[item.campo]!,
        field: item.campo,
        message: UNIQUE_CONSTRAINTS[item.constraint].message,
        deletedAtColumn: companies.deletedAt,
        excludeId,
      }),
    ),
  )

  const issues: Record<string, string[]> = {}
  for (const resultado of resultados) {
    if (resultado.status === 'fulfilled') continue
    // Falha de banco não é duplicata: precisa subir inteira em vez de virar erro de formulário.
    if (!(resultado.reason instanceof AppError) || !resultado.reason.issues) throw resultado.reason
    Object.assign(issues, resultado.reason.issues)
  }

  const repetidos = Object.values(issues)
  if (repetidos.length === 0) return

  throw new AppError(
    repetidos.length === 1 ? repetidos[0][0] : 'Alguns dados já estão em uso por outra empresa',
    409,
    'DUPLICATE_ENTRY',
    issues,
  )
}

/** `users_email_active_unique` é remapeado porque no formulário o campo se chama `adminEmail`. */
const DUPLICATA_NO_CADASTRO: Record<string, { field: string; message: string }> = {
  ...Object.fromEntries(
    CAMPOS_UNICOS_DA_EMPRESA.map((item) => [item.constraint, UNIQUE_CONSTRAINTS[item.constraint]]),
  ),
  users_email_active_unique: {
    field: 'adminEmail',
    message: UNIQUE_CONSTRAINTS.users_email_active_unique.message,
  },
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

/** Só o cadastro público passa isto; o do super_admin cai no padrão da coluna, que é `ativa`. */
export interface AssinaturaInicial {
  planId: string
  trialEndsOn: string
  /** Instante em que a pessoa marcou o aceite do aviso de privacidade. */
  privacyAcceptedAt: Date
}

export async function createCompanyWithAdmin(data: CreateCompanyInput, assinatura?: AssinaturaInicial) {
  await Promise.all([
    assertUniqueUserEmail(data.adminEmail, { field: 'adminEmail' }),
    assertEmpresaSemDuplicata(data),
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
          ...(assinatura
            ? {
                planId: assinatura.planId,
                trialEndsOn: assinatura.trialEndsOn,
                subscriptionStatus: 'teste' as const,
                privacyAcceptedAt: assinatura.privacyAcceptedAt,
              }
            : {}),
        })
        .returning()

      const [admin] = await tx
        .insert(users)
        .values({
          companyId: company.id,
          name: data.adminName,
          email: data.adminEmail,
          passwordHash,
          passwordChangedAt: new Date(),
          role: 'admin',
        })
        .returning()

      return {
        company,
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
      }
    })
  } catch (error) {
    // A checagem acima cobre o caso normal; este `catch` cobre a corrida entre dois cadastros
    // simultâneos, em que os dois passam na consulta e só o índice separa um do outro.
    const duplicata = DUPLICATA_NO_CADASTRO[uniqueViolationConstraint(error) ?? '']
    if (duplicata) throw AppError.duplicate(duplicata.field, duplicata.message)

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
  await assertEmpresaSemDuplicata(data, id)

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
