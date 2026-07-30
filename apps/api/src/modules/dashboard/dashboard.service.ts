import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories, losses, products, stockMovements } from '../../db/schema/index.js'

const DEFAULT_SPAN_DAYS = 30
const MAX_SPAN_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

function formatDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

function resolvePeriod(range: { from?: Date; to?: Date }) {
  const periodEnd = range.to ? new Date(range.to) : new Date()
  periodEnd.setHours(23, 59, 59, 999)

  let periodStart: Date
  if (range.from) {
    periodStart = new Date(range.from)
  } else {
    periodStart = new Date(periodEnd)
    periodStart.setDate(periodStart.getDate() - (DEFAULT_SPAN_DAYS - 1))
  }
  periodStart.setHours(0, 0, 0, 0)

  const maxSpanMs = MAX_SPAN_DAYS * DAY_MS
  if (periodEnd.getTime() - periodStart.getTime() > maxSpanMs) {
    periodStart = new Date(periodEnd.getTime() - maxSpanMs)
    periodStart.setHours(0, 0, 0, 0)
  }

  return { periodStart, periodEnd }
}

export async function getDashboardSummary(companyId: string, range: { from?: Date; to?: Date }) {
  const { periodStart, periodEnd } = resolvePeriod(range)

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

  const recentLosses = await db
    .select()
    .from(losses)
    .where(and(eq(losses.companyId, companyId), gte(losses.lossDate, periodStart), lte(losses.lossDate, periodEnd)))

  const lossesQuantity = recentLosses.reduce((sum, loss) => sum + Number(loss.quantity), 0)

  const lossesByReasonMap = new Map<string, number>()
  for (const loss of recentLosses) {
    lossesByReasonMap.set(loss.reason, (lossesByReasonMap.get(loss.reason) ?? 0) + Number(loss.quantity))
  }
  const lossesByReason = Array.from(lossesByReasonMap, ([reason, quantity]) => ({ reason, quantity }))

  const recentMovements = await db.query.stockMovements.findMany({
    where: and(
      eq(stockMovements.companyId, companyId),
      gte(stockMovements.createdAt, periodStart),
      lte(stockMovements.createdAt, periodEnd),
    ),
    with: { product: true },
    orderBy: desc(stockMovements.createdAt),
    limit: 10,
  })

  const timelineRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${stockMovements.createdAt}), 'YYYY-MM-DD')`,
      type: stockMovements.type,
      quantity: sql<number>`coalesce(sum(abs(${stockMovements.quantity})), 0)`.mapWith(Number),
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.companyId, companyId),
        gte(stockMovements.createdAt, periodStart),
        lte(stockMovements.createdAt, periodEnd),
      ),
    )
    .groupBy(sql`date_trunc('day', ${stockMovements.createdAt})`, stockMovements.type)

  const timelineByDay = new Map<string, { entrada: number; perda: number }>()
  for (const row of timelineRows) {
    const bucket = timelineByDay.get(row.day) ?? { entrada: 0, perda: 0 }
    if (row.type === 'entrada') bucket.entrada += row.quantity
    if (row.type === 'perda') bucket.perda += row.quantity
    timelineByDay.set(row.day, bucket)
  }

  const dayCount = Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS) + 1
  const movementsTimeline = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(periodStart)
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
    periodFrom: formatDay(periodStart),
    periodTo: formatDay(periodEnd),
    lossesInPeriod: {
      lossesCount: recentLosses.length,
      lossesQuantity,
    },
    recentMovements,
    movementsTimeline,
    stockByCategory,
    lossesByReason,
  }
}
