import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte } from 'drizzle-orm'
import { MOVEMENT_TYPE_LABEL_ORDER, orderByColumn, orderByLabeledEnum } from '../../shared/db/sorting.js'
import { db } from '../../db/client.js'
import { products, stockMovements } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { applyStockMovement } from '../../shared/db/applyStockMovement.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { matchingProductIds } from '../../shared/db/matchingProductIds.js'
import type { CreateStockAdjustmentInput, ListStockMovementsQuery, ListStockQuery } from './stock.schema.js'

export async function listCurrentStock(companyId: string, query: ListStockQuery) {
  const conditions = [eq(products.companyId, companyId), isNull(products.deletedAt)]
  if (query.search) conditions.push(ilike(products.name, `%${query.search}%`))
  if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId))
  if (query.lowStockOnly) conditions.push(lte(products.currentStock, products.minStock))
  const where = and(...conditions)
  const stockOrderBy = orderByColumn(query.sortBy ? products[query.sortBy] : products.name, query.sortOrder)

  const [data, [{ total }]] = await Promise.all([
    db.query.products.findMany({
      where,
      with: { category: true, unit: true },
      orderBy: [stockOrderBy, asc(products.name)],
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
    conditions.push(inArray(stockMovements.productId, matchingProductIds(companyId, query.search)))
  }
  if (query.productId) conditions.push(eq(stockMovements.productId, query.productId))
  if (query.type) conditions.push(eq(stockMovements.type, query.type))
  if (query.from) conditions.push(gte(stockMovements.movementDate, query.from))
  if (query.to) conditions.push(lte(stockMovements.movementDate, query.to))
  const where = and(...conditions)
  const movementOrderBy =
    query.sortBy === 'type'
      ? orderByLabeledEnum(stockMovements.type, MOVEMENT_TYPE_LABEL_ORDER, query.sortOrder)
      : orderByColumn(query.sortBy ? stockMovements[query.sortBy] : stockMovements.movementDate, query.sortOrder, 'desc')

  const [data, [{ total }]] = await Promise.all([
    db.query.stockMovements.findMany({
      where,
      with: {
        product: true,
        createdByUser: { columns: { id: true, name: true } },
      },
      orderBy: [movementOrderBy, desc(stockMovements.movementDate), desc(stockMovements.createdAt)],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(stockMovements).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function createStockAdjustment(companyId: string, userId: string, data: CreateStockAdjustmentInput) {
  return db.transaction(async (tx) => {
    const movements = []

    for (const item of data.items) {
      const [product] = await tx
        .select({ currentStock: products.currentStock })
        .from(products)
        .where(and(eq(products.id, item.productId), eq(products.companyId, companyId), isNull(products.deletedAt)))
        .for('update')

      if (!product) throw AppError.notFound(`Produto não encontrado: ${item.productId}`)

      const previousStock = Number(product.currentStock)
      const delta = item.quantity - previousStock
      if (delta === 0) continue

      const movement = await applyStockMovement(tx, {
        companyId,
        userId,
        productId: item.productId,
        delta,
        type: 'ajuste',
        referenceType: 'adjustment',
        referenceId: item.productId,
        notes: data.notes,
      })

      movements.push(movement)
    }

    if (movements.length === 0) {
      throw new AppError('Nenhuma das quantidades informadas é diferente do estoque atual', 422, 'NO_CHANGE')
    }

    return movements
  })
}
