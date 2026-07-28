import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { products, stockMovements } from '../../db/schema/index.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import type { ListStockMovementsQuery, ListStockQuery } from './stock.schema.js'

export async function listCurrentStock(companyId: string, query: ListStockQuery) {
  const conditions = [eq(products.companyId, companyId), isNull(products.deletedAt)]
  if (query.search) conditions.push(ilike(products.name, `%${query.search}%`))
  if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId))
  if (query.lowStockOnly) conditions.push(lte(products.currentStock, products.minStock))
  const where = and(...conditions)

  const [data, [{ total }]] = await Promise.all([
    db.query.products.findMany({
      where,
      with: { category: true, unit: true },
      orderBy: asc(products.name),
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(products).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function listStockMovements(companyId: string, query: ListStockMovementsQuery) {
  const conditions = [eq(stockMovements.companyId, companyId)]
  if (query.search) {
    const matchingProductIds = db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.companyId, companyId), ilike(products.name, `%${query.search}%`)))

    conditions.push(inArray(stockMovements.productId, matchingProductIds))
  }
  if (query.productId) conditions.push(eq(stockMovements.productId, query.productId))
  if (query.type) conditions.push(eq(stockMovements.type, query.type))
  if (query.from) conditions.push(gte(stockMovements.createdAt, query.from))
  if (query.to) conditions.push(lte(stockMovements.createdAt, query.to))
  const where = and(...conditions)

  const [data, [{ total }]] = await Promise.all([
    db.query.stockMovements.findMany({
      where,
      with: { product: true },
      orderBy: desc(stockMovements.createdAt),
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(stockMovements).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}
