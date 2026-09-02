import { and, asc, count, eq, gte, ilike, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { companies, companyBillings } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { orderByColumn } from '../../shared/db/sorting.js'
import { getCompany, isPlatformCompany } from '../companies/companies.service.js'
import { addDaysToIsoDate, todayIsoDate } from '../../shared/utils/date.js'
import type { BillingStatus, CreateBillingInput, ListBillingsQuery, UpdateBillingInput } from './billings.schema.js'

function normalizedValues(data: CreateBillingInput | UpdateBillingInput, actorId: string) {
  return {
    companyId: data.companyId,
    referenceMonth: `${data.referenceMonth}-01`,
    dueDate: data.dueDate,
    amount: data.amount.toFixed(2),
    paidAmount: data.paidAmount?.toFixed(2) ?? null,
    paidAt: data.paidAt ?? null,
    notes: data.notes || null,
    updatedBy: actorId,
    updatedAt: new Date(),
  }
}

function statusExpression(today: string) {
  return sql<BillingStatus>`case
    when ${companyBillings.paidAt} is not null then 'paid'
    when ${companyBillings.dueDate} < ${today} then 'overdue'
    else 'pending'
  end`
}

export async function listBillings(query: ListBillingsQuery) {
  const today = todayIsoDate()
  const conditions = [isNull(companies.deletedAt)]
  if (query.search) conditions.push(ilike(companies.name, `%${query.search}%`))
  if (query.from) conditions.push(gte(companyBillings.dueDate, query.from))
  if (query.to) conditions.push(lte(companyBillings.dueDate, query.to))
  if (query.status === 'paid') conditions.push(isNotNull(companyBillings.paidAt))
  if (query.status === 'pending') conditions.push(and(isNull(companyBillings.paidAt), gte(companyBillings.dueDate, today))!)
  if (query.status === 'overdue') conditions.push(and(isNull(companyBillings.paidAt), lt(companyBillings.dueDate, today))!)
  const where = and(...conditions)

  const sortColumns = {
    companyName: companies.name,
    referenceMonth: companyBillings.referenceMonth,
    dueDate: companyBillings.dueDate,
    amount: companyBillings.amount,
    paidAt: companyBillings.paidAt,
  }
  const order = orderByColumn(sortColumns[query.sortBy ?? 'dueDate'], query.sortOrder, 'desc')

  const select = db
    .select({
      id: companyBillings.id,
      companyId: companyBillings.companyId,
      companyName: companies.name,
      referenceMonth: companyBillings.referenceMonth,
      dueDate: companyBillings.dueDate,
      amount: companyBillings.amount,
      paidAmount: companyBillings.paidAmount,
      paidAt: companyBillings.paidAt,
      status: statusExpression(today),
      notes: companyBillings.notes,
      createdAt: companyBillings.createdAt,
      updatedAt: companyBillings.updatedAt,
    })
    .from(companyBillings)
    .innerJoin(companies, eq(companies.id, companyBillings.companyId))
    .where(where)

  const [data, [{ total }]] = await Promise.all([
    select.orderBy(order, asc(companies.name)).limit(query.pageSize).offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(companyBillings).innerJoin(companies, eq(companies.id, companyBillings.companyId)).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

async function assertBillableCompany(companyId: string) {
  await getCompany(companyId)

  if (await isPlatformCompany(companyId)) {
    throw AppError.forbidden('A empresa da plataforma não recebe cobranças')
  }
}

export async function createBilling(data: CreateBillingInput, actorId: string) {
  await assertBillableCompany(data.companyId)

  const [billing] = await db.insert(companyBillings).values({
    ...normalizedValues(data, actorId),
    createdBy: actorId,
  }).returning()
  return billing
}

export async function updateBilling(id: string, data: UpdateBillingInput, actorId: string) {
  await assertBillableCompany(data.companyId)

  const [billing] = await db.update(companyBillings).set(normalizedValues(data, actorId)).where(eq(companyBillings.id, id)).returning()
  if (!billing) throw AppError.notFound('Cobrança não encontrada')
  return billing
}

export async function deleteBilling(id: string) {
  const [billing] = await db.delete(companyBillings).where(eq(companyBillings.id, id)).returning({ id: companyBillings.id })
  if (!billing) throw AppError.notFound('Cobrança não encontrada')
}

/** Quantas empresas o painel do sino lista antes de mandar o super admin para a tela de cobranças. */
export const MAX_COBRANCAS_NO_ALERTA = 5

/** Janela de "vence logo": o que ainda dá tempo de cobrar antes de virar atraso. */
const DIAS_DE_VENCIMENTO_PROXIMO = 7

export async function getBillingAlerts() {
  const hoje = todayIsoDate()
  const limiteProximo = addDaysToIsoDate(hoje, DIAS_DE_VENCIMENTO_PROXIMO)

  const emAberto = and(isNull(companies.deletedAt), isNull(companyBillings.paidAt))
  const atrasadas = and(emAberto, lt(companyBillings.dueDate, hoje))

  const [[contagens], cobrancasAtrasadas] = await Promise.all([
    db
      .select({
        overdue: sql<number>`count(*) filter (where ${companyBillings.dueDate} < ${hoje})`.mapWith(Number),
        overdueValue:
          sql<number>`coalesce(sum(${companyBillings.amount}) filter (where ${companyBillings.dueDate} < ${hoje}), 0)`.mapWith(
            Number,
          ),
        dueSoon:
          sql<number>`count(*) filter (where ${companyBillings.dueDate} >= ${hoje} and ${companyBillings.dueDate} <= ${limiteProximo})`.mapWith(
            Number,
          ),
      })
      .from(companyBillings)
      .innerJoin(companies, eq(companies.id, companyBillings.companyId))
      .where(emAberto),
    db
      .select({
        id: companyBillings.id,
        companyName: companies.name,
        referenceMonth: companyBillings.referenceMonth,
        dueDate: companyBillings.dueDate,
        amount: companyBillings.amount,
      })
      .from(companyBillings)
      .innerJoin(companies, eq(companies.id, companyBillings.companyId))
      .where(atrasadas)
      .orderBy(asc(companyBillings.dueDate), asc(companies.name))
      .limit(MAX_COBRANCAS_NO_ALERTA),
  ])

  return {
    generatedAt: new Date().toISOString(),
    // Só o atraso conta no sino: vencimento futuro é agenda, não pendência.
    total: contagens.overdue,
    overdueCount: contagens.overdue,
    overdueValue: contagens.overdueValue,
    dueSoonCount: contagens.dueSoon,
    billings: cobrancasAtrasadas,
  }
}
