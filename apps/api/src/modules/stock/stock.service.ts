import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { products, stockMovements } from '../../db/schema/index.js'

export async function listCurrentStock(companyId: string) {
  return db.query.products.findMany({
    where: and(eq(products.companyId, companyId), isNull(products.deletedAt)),
    with: { category: true, unit: true },
    orderBy: asc(products.name),
  })
}

export async function listStockMovements(companyId: string, productId?: string) {
  const conditions = [eq(stockMovements.companyId, companyId)]

  if (productId) {
    conditions.push(eq(stockMovements.productId, productId))
  }

  return db.query.stockMovements.findMany({
    where: and(...conditions),
    with: { product: true },
    orderBy: desc(stockMovements.createdAt),
  })
}
