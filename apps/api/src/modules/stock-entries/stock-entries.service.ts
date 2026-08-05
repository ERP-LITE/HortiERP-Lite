import { and, count, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { products, stockEntries, stockMovements, stockEntryItems } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { matchingProductIds } from '../../shared/db/matchingProductIds.js'
import type { CreateStockEntryInput, ListStockEntriesQuery } from './stock-entries.schema.js'

export async function listStockEntries(companyId: string, query: ListStockEntriesQuery) {
  const conditions = [eq(stockEntries.companyId, companyId)]
  if (query.search) {
    const matchingEntryIds = db
      .select({ id: stockEntryItems.stockEntryId })
      .from(stockEntryItems)
      .where(inArray(stockEntryItems.productId, matchingProductIds(companyId, query.search)))

    conditions.push(
      or(
        ilike(stockEntries.supplierName, `%${query.search}%`),
        inArray(stockEntries.id, matchingEntryIds),
      )!,
    )
  }
  if (query.from) conditions.push(gte(stockEntries.entryDate, query.from))
  if (query.to) conditions.push(lte(stockEntries.entryDate, query.to))
  const where = and(...conditions)

  const [data, [{ total }]] = await Promise.all([
    db.query.stockEntries.findMany({
      where,
      with: {
        createdByUser: { columns: { id: true, name: true } },
        items: { with: { product: true } },
      },
      orderBy: (entries, { desc: desc_ }) => [desc_(entries.entryDate)],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(stockEntries).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function getStockEntry(companyId: string, id: string) {
  const entry = await db.query.stockEntries.findFirst({
    where: and(eq(stockEntries.id, id), eq(stockEntries.companyId, companyId)),
    with: {
      createdByUser: { columns: { id: true, name: true } },
      items: { with: { product: true } },
    },
  })

  if (!entry) throw AppError.notFound('Entrada de mercadoria não encontrada')

  return entry
}

export async function createStockEntry(companyId: string, userId: string, data: CreateStockEntryInput) {
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(stockEntries)
      .values({
        companyId,
        supplierName: data.supplierName,
        entryDate: data.entryDate ?? new Date(),
        notes: data.notes,
        createdBy: userId,
      })
      .returning()

    for (const item of data.items) {
      const [updatedProduct] = await tx
        .update(products)
        .set({
          currentStock: sql`${products.currentStock} + ${item.quantity.toString()}`,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(eq(products.id, item.productId), eq(products.companyId, companyId)))
        .returning({ currentStock: products.currentStock })

      if (!updatedProduct) {
        throw AppError.notFound(`Produto não encontrado: ${item.productId}`)
      }

      await tx.insert(stockEntryItems).values({
        stockEntryId: entry.id,
        productId: item.productId,
        quantity: item.quantity.toString(),
        unitCost: item.unitCost?.toString(),
      })

      await tx.insert(stockMovements).values({
        companyId,
        productId: item.productId,
        type: 'entrada',
        quantity: item.quantity.toString(),
        balanceAfter: updatedProduct.currentStock,
        referenceType: 'stock_entry',
        referenceId: entry.id,
        createdBy: userId,
      })
    }

    return entry
  })
}
