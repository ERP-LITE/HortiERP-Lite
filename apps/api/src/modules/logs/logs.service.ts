import { and, count, desc, eq, gte, ilike, lte, ne, or } from 'drizzle-orm'
import { orderByColumn } from '../../shared/db/sorting.js'
import { db } from '../../db/client.js'
import { companies, systemLogs, users } from '../../db/schema/index.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import type { ListLogsQuery } from './logs.schema.js'

const logColumns = {
  id: systemLogs.id,
  companyId: systemLogs.companyId,
  companyName: companies.name,
  actorId: systemLogs.actorId,
  actorName: users.name,
  actorEmail: users.email,
  actorRole: systemLogs.actorRole,
  method: systemLogs.method,
  path: systemLogs.path,
  statusCode: systemLogs.statusCode,
  durationMs: systemLogs.durationMs,
  level: systemLogs.level,
  errorCode: systemLogs.errorCode,
  errorMessage: systemLogs.errorMessage,
  ip: systemLogs.ip,
  userAgent: systemLogs.userAgent,
  metadata: systemLogs.metadata,
  createdAt: systemLogs.createdAt,
}

function periodConditions(query: ListLogsQuery) {
  const conditions = []
  if (query.from) {
    const from = new Date(query.from)
    from.setHours(0, 0, 0, 0)
    conditions.push(gte(systemLogs.createdAt, from))
  }
  if (query.to) {
    const to = new Date(query.to)
    to.setHours(23, 59, 59, 999)
    conditions.push(lte(systemLogs.createdAt, to))
  }
  return conditions
}

async function queryLogs(conditions: ReturnType<typeof eq>[], query: ListLogsQuery, includeTechnicalDetails: boolean) {
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(
      includeTechnicalDetails
        ? or(
            ilike(systemLogs.path, term),
            ilike(systemLogs.errorMessage, term),
            ilike(companies.name, term),
            ilike(users.name, term),
            ilike(users.email, term),
          )!
        : or(ilike(systemLogs.path, term), ilike(users.name, term), ilike(users.email, term))!,
    )
  }
  if (query.method) conditions.push(eq(systemLogs.method, query.method))
  if (query.level) conditions.push(eq(systemLogs.level, query.level))
  conditions.push(...periodConditions(query))
  const where = and(...conditions)
  const sortColumns = {
    createdAt: systemLogs.createdAt,
    companyName: companies.name,
    actorName: users.name,
    level: systemLogs.level,
    statusCode: systemLogs.statusCode,
  }
  // `level` fica na ordem de declaração do enum de propósito: ali ela equivale
  // à ordem de severidade, que é mais útil do que a ordem alfabética.
  const orderBy = orderByColumn(query.sortBy ? sortColumns[query.sortBy] : systemLogs.createdAt, query.sortOrder, 'desc')

  const baseQuery = db
    .select(logColumns)
    .from(systemLogs)
    .leftJoin(companies, eq(systemLogs.companyId, companies.id))
    .leftJoin(users, eq(systemLogs.actorId, users.id))

  const countQuery = db
    .select({ total: count() })
    .from(systemLogs)
    .leftJoin(companies, eq(systemLogs.companyId, companies.id))
    .leftJoin(users, eq(systemLogs.actorId, users.id))

  const [data, [{ total }]] = await Promise.all([
    baseQuery
      .where(where)
      .orderBy(orderBy, desc(systemLogs.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    countQuery.where(where),
  ])

  const visibleData = includeTechnicalDetails
    ? data
    : data.map(({ durationMs: _durationMs, errorCode: _errorCode, errorMessage: _errorMessage, ip: _ip, userAgent: _userAgent, metadata: _metadata, ...log }) => log)

  return buildPaginatedResult(visibleData, total, query.page, query.pageSize)
}

export function listTechnicalLogs(query: ListLogsQuery) {
  const conditions: ReturnType<typeof eq>[] = []
  if (query.companyId) conditions.push(eq(systemLogs.companyId, query.companyId))
  return queryLogs(conditions, query, true)
}

export function listCompanyActivityLogs(companyId: string, query: ListLogsQuery) {
  return queryLogs(
    [
      eq(systemLogs.companyId, companyId),
      ne(systemLogs.method, 'GET'),
    ],
    query,
    false,
  )
}
