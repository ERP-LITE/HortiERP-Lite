import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { db } from '../../db/client.js'
import { products } from '../../db/schema/index.js'
import { AppError } from '../errors/AppError.js'

interface AssertNotUsedByProductsOptions {
  companyId: string
  ids: string[]
  column: PgColumn
  reference: string
  action: string
}

export async function assertNotUsedByProducts({
  companyId,
  ids,
  column,
  reference,
  action,
}: AssertNotUsedByProductsOptions) {
  if (ids.length === 0) return

  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .where(and(eq(products.companyId, companyId), isNull(products.deletedAt), inArray(column, ids)))

  if (total > 0) {
    throw AppError.conflict(
      `${total} produto(s) ${reference}. Troque ${action} desses produtos antes de excluir, ou apenas inative ` +
        `para ela deixar de aparecer em produto novo.`,
    )
  }
}
