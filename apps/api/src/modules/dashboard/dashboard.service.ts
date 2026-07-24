import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories, losses, products, stockMovements } from '../../db/schema/index.js'

const TIMELINE_DAYS = 14

function formatDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

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

  const lossesByReasonMap = new Map<string, number>()
  for (const loss of recentLosses) {
    lossesByReasonMap.set(loss.reason, (lossesByReasonMap.get(loss.reason) ?? 0) + Number(loss.quantity))
  }
  const lossesByReason = Array.from(lossesByReasonMap, ([reason, quantity]) => ({ reason, quantity }))

  const recentMovements = await db.query.stockMovements.findMany({
    where: eq(stockMovements.companyId, companyId),
    with: { product: true },
    orderBy: desc(stockMovements.createdAt),
    limit: 10,
  })

  const timelineStart = new Date()
  timelineStart.setDate(timelineStart.getDate() - (TIMELINE_DAYS - 1))
  timelineStart.setHours(0, 0, 0, 0)

  const timelineRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${stockMovements.createdAt}), 'YYYY-MM-DD')`,
      type: stockMovements.type,
      quantity: sql<number>`coalesce(sum(abs(${stockMovements.quantity})), 0)`.mapWith(Number),
    })
    .from(stockMovements)
    .where(and(eq(stockMovements.companyId, companyId), gte(stockMovements.createdAt, timelineStart)))
    .groupBy(sql`date_trunc('day', ${stockMovements.createdAt})`, stockMovements.type)

  const timelineByDay = new Map<string, { entrada: number; perda: number }>()
  for (const row of timelineRows) {
    const bucket = timelineByDay.get(row.day) ?? { entrada: 0, perda: 0 }
    if (row.type === 'entrada') bucket.entrada += row.quantity
    if (row.type === 'perda') bucket.perda += row.quantity
    timelineByDay.set(row.day, bucket)
  }

  const movementsTimeline = Array.from({ length: TIMELINE_DAYS }, (_, index) => {
    const date = new Date(timelineStart)
    date.setDate(date.getDate() + index)
    const key = formatDay(date)
    const bucket = timelineByDay.get(key) ?? { entrada: 0, perda: 0 }
    return { date: key, entrada: bucket.entrada, perda: bucket.perda }
  })

  const stockByCategoryRows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      totalStock: sql<number>`coalesce(sum(${products.currentStock}), 0)`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(
      products,
      and(eq(products.categoryId, categories.id), isNull(products.deletedAt), eq(products.active, true)),
    )
    .where(eq(categories.companyId, companyId))
    .groupBy(categories.id, categories.name)

  const stockByCategory = stockByCategoryRows
    .filter((row) => row.totalStock > 0)
    .sort((a, b) => b.totalStock - a.totalStock)

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
    movementsTimeline,
    stockByCategory,
    lossesByReason,
  }
}
