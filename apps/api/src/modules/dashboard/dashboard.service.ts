import { and, desc, eq, gte, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { losses, products, stockMovements } from '../../db/schema/index.js'

export async function getDashboardSummary(companyId: string) {
  const activeProducts = await db
    .select()
    .from(products)
    .where(and(eq(products.companyId, companyId), isNull(products.deletedAt), eq(products.active, true)))

  const lowStockProducts = activeProducts.filter(
    (product) => Number(product.currentStock) <= Number(product.minStock),
  )

  const stockValue = activeProducts.reduce(
    (sum, product) => sum + Number(product.currentStock) * Number(product.costPrice ?? 0),
    0,
  )

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentLosses = await db
    .select()
    .from(losses)
    .where(and(eq(losses.companyId, companyId), gte(losses.lossDate, thirtyDaysAgo)))

  const lossesQuantity = recentLosses.reduce((sum, loss) => sum + Number(loss.quantity), 0)

  const recentMovements = await db.query.stockMovements.findMany({
    where: eq(stockMovements.companyId, companyId),
    with: { product: true },
    orderBy: desc(stockMovements.createdAt),
    limit: 10,
  })

  return {
    totalProducts: activeProducts.length,
    lowStockCount: lowStockProducts.length,
    lowStockProducts: lowStockProducts
      .sort((a, b) => Number(a.currentStock) - Number(b.currentStock))
      .slice(0, 10),
    stockValue,
    last30Days: {
      lossesCount: recentLosses.length,
      lossesQuantity,
    },
    recentMovements,
  }
}
