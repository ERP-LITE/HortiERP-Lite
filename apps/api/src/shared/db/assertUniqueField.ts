import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { db } from '../../db/client.js'
import { AppError } from '../errors/AppError.js'

interface AssertUniqueFieldOptions {
  table: PgTable
  idColumn: PgColumn
  valueColumn: PgColumn
  value: string
  field: string
  message: string
  companyIdColumn?: PgColumn
  companyId?: string
  deletedAtColumn?: PgColumn
  excludeId?: string
}

export async function assertUniqueField(options: AssertUniqueFieldOptions) {
  const { table, idColumn, valueColumn, value, field, message, companyIdColumn, companyId, deletedAtColumn, excludeId } =
    options

  const conditions = [sql`lower(${valueColumn}) = lower(${value})`]
  if (companyIdColumn && companyId) conditions.push(eq(companyIdColumn, companyId))
  if (deletedAtColumn) conditions.push(isNull(deletedAtColumn))
  if (excludeId) conditions.push(ne(idColumn, excludeId))

  const [existing] = await db
    .select({ id: idColumn })
    .from(table)
    .where(and(...conditions))

  if (existing) throw AppError.duplicate(field, message)
}
