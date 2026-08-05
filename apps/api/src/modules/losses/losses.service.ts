import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { losses, products, stockMovements } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { matchingProductIds } from '../../shared/db/matchingProductIds.js'
import type { CreateLossInput, ListLossesQuery } from './losses.schema.js'

export async function listLosses(companyId: string, query: ListLossesQuery) {
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
  const where = and(...conditions)

  const [data, [{ total }]] = await Promise.all([
    db.query.losses.findMany({
      where,
      with: {
        createdByUser: { columns: { id: true, name: true } },
        product: true,
      },
      orderBy: desc(losses.lossDate),
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
    const quantity = data.quantity.toString()
    const [updatedProduct] = await tx
      .update(products)
      .set({
        currentStock: sql`${products.currentStock} - ${quantity}`,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(products.id, data.productId),
          eq(products.companyId, companyId),
          gte(products.currentStock, quantity),
        ),
      )
      .returning({ currentStock: products.currentStock })

    if (!updatedProduct) {
      const [product] = await tx
        .select({ currentStock: products.currentStock })
        .from(products)
        .where(and(eq(products.id, data.productId), eq(products.companyId, companyId)))

      if (!product) throw AppError.notFound('Produto não encontrado')

      throw new AppError(
        `Quantidade de perda (${data.quantity}) maior que o estoque disponível (${product.currentStock})`,
        422,
        'INSUFFICIENT_STOCK',
      )
    }

    const [loss] = await tx
      .insert(losses)
      .values({
        companyId,
        productId: data.productId,
        quantity: data.quantity.toString(),
        reason: data.reason,
        notes: data.notes,
        lossDate: data.lossDate ?? new Date(),
        createdBy: userId,
      })
      .returning()

    await tx.insert(stockMovements).values({
      companyId,
      productId: data.productId,
      type: 'perda',
      quantity: (-data.quantity).toString(),
      balanceAfter: updatedProduct.currentStock,
      referenceType: 'loss',
      referenceId: loss.id,
      createdBy: userId,
    })

    return loss
  })
}
