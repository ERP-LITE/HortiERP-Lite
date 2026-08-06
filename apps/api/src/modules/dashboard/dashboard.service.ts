import { and, asc, count, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories, losses, products, stockMovements, units } from '../../db/schema/index.js'

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

  const activeProductConditions = and(
    eq(products.companyId, companyId),
    isNull(products.deletedAt),
    eq(products.active, true),
  )
  const lowStockConditions = and(activeProductConditions, lte(products.currentStock, products.minStock))
  const lossPeriodConditions = and(
    eq(losses.companyId, companyId),
    gte(losses.lossDate, periodStart),
    lte(losses.lossDate, periodEnd),
  )

  const [[productSummary], [{ lowStockCount }], lowStockProducts, [lossSummary], lossesByReasonRows] = await Promise.all([
    db
      .select({
        totalProducts: count(),
        stockValue: sql<number>`coalesce(sum(${products.currentStock} * coalesce(${products.costPrice}, 0)), 0)`.mapWith(Number),
      })
      .from(products)
      .where(activeProductConditions),
    db.select({ lowStockCount: count() }).from(products).where(lowStockConditions),
    db.select().from(products).where(lowStockConditions).orderBy(asc(products.currentStock)).limit(10),
    db
      .select({
        lossesCount: count(),
        lossValue: sql<number>`coalesce(sum(${losses.quantity} * coalesce(${losses.unitCost}, ${products.costPrice}, 0)), 0)`.mapWith(Number),
      })
      .from(losses)
      .innerJoin(products, eq(products.id, losses.productId))
      .where(lossPeriodConditions),
    db
      .select({
        reason: losses.reason,
        productId: products.id,
        productName: products.name,
        unitId: units.id,
        unitName: units.name,
        unitAbbreviation: units.abbreviation,
        lossesCount: count(),
        quantity: sql<number>`coalesce(sum(${losses.quantity}), 0)`.mapWith(Number),
      })
      .from(losses)
      .innerJoin(products, eq(products.id, losses.productId))
      .innerJoin(units, eq(units.id, products.unitId))
      .where(lossPeriodConditions)
      .groupBy(losses.reason, products.id, products.name, units.id, units.name, units.abbreviation),
  ])

  const recentMovements = await db.query.stockMovements.findMany({
    where: and(
      eq(stockMovements.companyId, companyId),
      gte(stockMovements.createdAt, periodStart),
      lte(stockMovements.createdAt, periodEnd),
    ),
    with: {
      product: true,
      createdByUser: { columns: { id: true, name: true } },
    },
    orderBy: desc(stockMovements.createdAt),
    limit: 10,
  })

  const timelineRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${stockMovements.createdAt}), 'YYYY-MM-DD')`,
      type: stockMovements.type,
      productId: products.id,
      productName: products.name,
      unitId: units.id,
      unitName: units.name,
      unitAbbreviation: units.abbreviation,
      movementsCount: count(),
      quantity: sql<number>`coalesce(sum(abs(${stockMovements.quantity})), 0)`.mapWith(Number),
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .innerJoin(units, eq(units.id, products.unitId))
    .where(
      and(
        eq(stockMovements.companyId, companyId),
        gte(stockMovements.createdAt, periodStart),
        lte(stockMovements.createdAt, periodEnd),
      ),
    )
    .groupBy(
      sql`date_trunc('day', ${stockMovements.createdAt})`,
      stockMovements.type,
      products.id,
      products.name,
      units.id,
      units.name,
      units.abbreviation,
    )

  type QuantityByUnit = {
    unitId: string
    unitName: string
    unitAbbreviation: string
    quantity: number
  }
  type ProductQuantity = {
    productId: string
    productName: string
    quantity: number
    unitAbbreviation: string
  }
  function addQuantityByUnit(target: QuantityByUnit[], value: QuantityByUnit) {
    const existing = target.find((item) => item.unitId === value.unitId)
    if (existing) existing.quantity += value.quantity
    else target.push({ ...value })
  }
  type TimelineBucket = {
    entradaCount: number
    perdaCount: number
    ajusteCount: number
    entradaByUnit: QuantityByUnit[]
    perdaByUnit: QuantityByUnit[]
    ajusteByUnit: QuantityByUnit[]
    entradaProducts: ProductQuantity[]
    perdaProducts: ProductQuantity[]
    ajusteProducts: ProductQuantity[]
  }
  const timelineByDay = new Map<string, TimelineBucket>()
  for (const row of timelineRows) {
    const bucket = timelineByDay.get(row.day) ?? {
      entradaCount: 0,
      perdaCount: 0,
      ajusteCount: 0,
      entradaByUnit: [],
      perdaByUnit: [],
      ajusteByUnit: [],
      entradaProducts: [],
      perdaProducts: [],
      ajusteProducts: [],
    }
    const quantity = {
      unitId: row.unitId,
      unitName: row.unitName,
      unitAbbreviation: row.unitAbbreviation,
      quantity: row.quantity,
    }
    if (row.type === 'entrada') {
      bucket.entradaCount += row.movementsCount
      addQuantityByUnit(bucket.entradaByUnit, quantity)
      bucket.entradaProducts.push({
        productId: row.productId,
        productName: row.productName,
        quantity: row.quantity,
        unitAbbreviation: row.unitAbbreviation,
      })
    }
    if (row.type === 'perda') {
      bucket.perdaCount += row.movementsCount
      addQuantityByUnit(bucket.perdaByUnit, quantity)
      bucket.perdaProducts.push({
        productId: row.productId,
        productName: row.productName,
        quantity: row.quantity,
        unitAbbreviation: row.unitAbbreviation,
      })
    }
    if (row.type === 'ajuste') {
      bucket.ajusteCount += row.movementsCount
      addQuantityByUnit(bucket.ajusteByUnit, quantity)
      bucket.ajusteProducts.push({
        productId: row.productId,
        productName: row.productName,
        quantity: row.quantity,
        unitAbbreviation: row.unitAbbreviation,
      })
    }
    timelineByDay.set(row.day, bucket)
  }

  const dayCount = Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS) + 1
  const movementsTimeline = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(periodStart)
    date.setDate(date.getDate() + index)
    const key = formatDay(date)
    const bucket = timelineByDay.get(key) ?? {
      entradaCount: 0,
      perdaCount: 0,
      ajusteCount: 0,
      entradaByUnit: [],
      perdaByUnit: [],
      ajusteByUnit: [],
      entradaProducts: [],
      perdaProducts: [],
      ajusteProducts: [],
    }
    return { date: key, ...bucket }
  })

  const stockByCategoryRows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      productId: products.id,
      productName: products.name,
      unitId: units.id,
      unitName: units.name,
      unitAbbreviation: units.abbreviation,
      totalStock: sql<number>`coalesce(sum(${products.currentStock}), 0)`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(
      products,
      and(eq(products.categoryId, categories.id), isNull(products.deletedAt), eq(products.active, true)),
    )
    .leftJoin(units, eq(units.id, products.unitId))
    .where(and(eq(categories.companyId, companyId), isNull(categories.deletedAt)))
    .groupBy(categories.id, categories.name, products.id, products.name, units.id, units.name, units.abbreviation)

  const categoryMap = new Map<string, {
    categoryId: string
    categoryName: string
    productCount: number
    totalsByUnit: QuantityByUnit[]
    products: ProductQuantity[]
  }>()
  for (const row of stockByCategoryRows) {
    const category = categoryMap.get(row.categoryId) ?? {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      productCount: 0,
      totalsByUnit: [],
      products: [],
    }
    if (row.productId && row.productName) category.productCount += 1
    if (row.productId && row.productName && row.unitId && row.unitName && row.unitAbbreviation && row.totalStock > 0) {
      addQuantityByUnit(category.totalsByUnit, {
        unitId: row.unitId,
        unitName: row.unitName,
        unitAbbreviation: row.unitAbbreviation,
        quantity: row.totalStock,
      })
      category.products.push({
        productId: row.productId,
        productName: row.productName,
        quantity: row.totalStock,
        unitAbbreviation: row.unitAbbreviation,
      })
    }
    categoryMap.set(row.categoryId, category)
  }
  const stockByCategory = [...categoryMap.values()]
    .filter((row) => row.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)

  const lossReasonMap = new Map<string, {
    reason: typeof lossesByReasonRows[number]['reason']
    lossesCount: number
    totalsByUnit: QuantityByUnit[]
    products: ProductQuantity[]
  }>()
  for (const row of lossesByReasonRows) {
    const reason = lossReasonMap.get(row.reason) ?? {
      reason: row.reason,
      lossesCount: 0,
      totalsByUnit: [],
      products: [],
    }
    reason.lossesCount += row.lossesCount
    addQuantityByUnit(reason.totalsByUnit, {
      unitId: row.unitId,
      unitName: row.unitName,
      unitAbbreviation: row.unitAbbreviation,
      quantity: row.quantity,
    })
    reason.products.push({
      productId: row.productId,
      productName: row.productName,
      quantity: row.quantity,
      unitAbbreviation: row.unitAbbreviation,
    })
    lossReasonMap.set(row.reason, reason)
  }
  const lossesByReason = [...lossReasonMap.values()]
  const lossesByUnitMap = new Map<string, QuantityByUnit>()
  for (const row of lossesByReasonRows) {
    const total = lossesByUnitMap.get(row.unitId) ?? {
      unitId: row.unitId,
      unitName: row.unitName,
      unitAbbreviation: row.unitAbbreviation,
      quantity: 0,
    }
    total.quantity += row.quantity
    lossesByUnitMap.set(row.unitId, total)
  }

  return {
    totalProducts: productSummary.totalProducts,
    lowStockCount,
    lowStockProducts,
    stockValue: productSummary.stockValue,
    periodFrom: formatDay(periodStart),
    periodTo: formatDay(periodEnd),
    lossesInPeriod: {
      lossesCount: lossSummary.lossesCount,
      lossValue: lossSummary.lossValue,
      totalsByUnit: [...lossesByUnitMap.values()],
    },
    recentMovements,
    movementsTimeline,
    stockByCategory,
    lossesByReason,
  }
}
