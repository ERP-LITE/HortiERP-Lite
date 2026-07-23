import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories, losses, products, stockEntries } from '../../db/schema/index.js'
import type { DateRangeQuery } from './reports.schema.js'

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
    .where(eq(categories.companyId, companyId))
    .groupBy(categories.id, categories.name)
    .orderBy(categories.name)
}

export async function getLossesReport(companyId: string, range: DateRangeQuery) {
  const conditions = [eq(losses.companyId, companyId)]

  if (range.from) conditions.push(gte(losses.lossDate, range.from))
  if (range.to) conditions.push(lte(losses.lossDate, range.to))

  const items = await db.query.losses.findMany({
    where: and(...conditions),
    with: { product: true },
    orderBy: (loss, { desc }) => [desc(loss.lossDate)],
  })

  const byReason = await db
    .select({
      reason: losses.reason,
      quantity: sql<number>`coalesce(sum(${losses.quantity}), 0)`.mapWith(Number),
      occurrences: sql<number>`count(${losses.id})`.mapWith(Number),
    })
    .from(losses)
    .where(and(...conditions))
    .groupBy(losses.reason)

  return { items, byReason }
}

export async function getStockEntriesReport(companyId: string, range: DateRangeQuery) {
  const conditions = [eq(stockEntries.companyId, companyId)]

  if (range.from) conditions.push(gte(stockEntries.entryDate, range.from))
  if (range.to) conditions.push(lte(stockEntries.entryDate, range.to))

  return db.query.stockEntries.findMany({
    where: and(...conditions),
    with: { items: { with: { product: true } } },
    orderBy: (entry, { desc }) => [desc(entry.entryDate)],
  })
}
