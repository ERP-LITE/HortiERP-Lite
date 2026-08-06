import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { losses, products } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { applyStockMovement } from '../../shared/db/applyStockMovement.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { matchingProductIds } from '../../shared/db/matchingProductIds.js'
import type { CreateLossInput, ListLossesQuery } from './losses.schema.js'

export function buildLossesConditions(
  companyId: string,
  query: Pick<ListLossesQuery, 'search' | 'productId' | 'reason' | 'from' | 'to'>,
) {
  const conditions = [eq(losses.companyId, companyId)]
  if (query.search) {
    conditions.push(
      or(ilike(losses.notes, `%${query.search}%`), inArray(losses.productId, matchingProductIds(companyId, query.search)))!,
    )
  }
  if (query.productId) conditions.push(eq(losses.productId, query.productId))
  if (query.reason) conditions.push(eq(losses.reason, query.reason))
  if (query.from) conditions.push(gte(losses.lossDate, query.from))
  if (query.to) conditions.push(lte(losses.lossDate, query.to))
  return conditions
}

export async function listLosses(companyId: string, query: ListLossesQuery) {
  const where = and(...buildLossesConditions(companyId, query))
  const lossSortColumn = query.sortBy ? losses[query.sortBy] : losses.lossDate
  const lossOrderBy = query.sortOrder === 'asc' ? asc(lossSortColumn) : desc(lossSortColumn)

  const [data, [{ total }]] = await Promise.all([
    db.query.losses.findMany({
      where,
      with: {
        createdByUser: { columns: { id: true, name: true } },
        product: true,
      },
      orderBy: [lossOrderBy, desc(losses.lossDate)],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(losses).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function getLoss(companyId: string, id: string) {
  const loss = await db.query.losses.findFirst({
    where: and(eq(losses.id, id), eq(losses.companyId, companyId)),
    with: {
      createdByUser: { columns: { id: true, name: true } },
      product: true,
    },
  })

  if (!loss) throw AppError.notFound('Registro de perda não encontrado')

  return loss
}

export async function createLoss(companyId: string, userId: string, data: CreateLossInput) {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ costPrice: products.costPrice })
      .from(products)
      .where(and(eq(products.id, data.productId), eq(products.companyId, companyId), isNull(products.deletedAt)))

    if (!product) throw AppError.notFound(`Produto não encontrado: ${data.productId}`)

    const [loss] = await tx
      .insert(losses)
      .values({
        companyId,
        productId: data.productId,
        quantity: data.quantity.toString(),
        unitCost: product.costPrice,
        reason: data.reason,
        notes: data.notes,
        lossDate: data.lossDate ?? new Date(),
        createdBy: userId,
      })
      .returning()

    await applyStockMovement(tx, {
      companyId,
      userId,
      productId: data.productId,
      delta: -data.quantity,
      type: 'perda',
      referenceType: 'loss',
      referenceId: loss.id,
      requireSufficientStock: true,
    })

    return loss
  })
}
