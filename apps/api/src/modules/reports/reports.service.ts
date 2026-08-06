import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories, losses, products } from '../../db/schema/index.js'
import type { DateRangeQuery } from './reports.schema.js'
import { buildLossesConditions, listLosses } from '../losses/losses.service.js'
import { listStockEntries } from '../stock-entries/stock-entries.service.js'

export async function getStockByCategoryReport(companyId: string) {
  return db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      productCount: sql<number>`count(${products.id})`.mapWith(Number),
      totalStock: sql<number>`coalesce(sum(${products.currentStock}), 0)`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(products, and(eq(products.categoryId, categories.id), isNull(products.deletedAt)))
    .where(and(eq(categories.companyId, companyId), isNull(categories.deletedAt)))
    .groupBy(categories.id, categories.name)
    .orderBy(categories.name)
}

export async function getLossesReport(companyId: string, range: DateRangeQuery) {
  const conditions = buildLossesConditions(companyId, range)

  const items = await listLosses(companyId, range)

  const byReason = await db
    .select({
      reason: losses.reason,
      quantity: sql<number>`coalesce(sum(${losses.quantity}), 0)`.mapWith(Number),
      occurrences: sql<number>`count(${losses.id})`.mapWith(Number),
    })
    .from(losses)
    .where(and(...conditions))
    .groupBy(losses.reason)

  return { ...items, byReason }
}

export async function getStockEntriesReport(companyId: string, range: DateRangeQuery) {
  return listStockEntries(companyId, range)
}
