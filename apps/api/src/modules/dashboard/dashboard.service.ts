import { and, asc, count, countDistinct, desc, eq, gt, gte, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories, losses, products, stockMovements, units } from '../../db/schema/index.js'
import {
  APP_TIME_ZONE,
  addDaysToIsoDate,
  businessDate,
  daysBetweenIsoDates,
  endOfBusinessDay,
  startOfBusinessDay,
  todayIsoDate,
} from '../../shared/utils/date.js'

const DEFAULT_SPAN_DAYS = 30
const MAX_SPAN_DAYS = 90

const BUSINESS_TIME_ZONE_SQL = sql.raw(`'${APP_TIME_ZONE}'`)

const TOP_PRODUCTS_PER_GROUP = 5

function resolvePeriod(range: { from?: Date; to?: Date }) {
  const endDate = range.to ? businessDate(range.to) : todayIsoDate()
  let startDate = range.from ? businessDate(range.from) : addDaysToIsoDate(endDate, -(DEFAULT_SPAN_DAYS - 1))

  // Período invertido produziria `dayCount` negativo e uma timeline vazia.
  if (startDate > endDate) startDate = endDate
  if (daysBetweenIsoDates(startDate, endDate) + 1 > MAX_SPAN_DAYS) {
    startDate = addDaysToIsoDate(endDate, -(MAX_SPAN_DAYS - 1))
  }

  return {
    startDate,
    endDate,
    periodStart: startOfBusinessDay(startDate),
    periodEnd: endOfBusinessDay(endDate),
  }
}

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

function otherProductsCount(totalProducts: number) {
  return Math.max(0, totalProducts - TOP_PRODUCTS_PER_GROUP)
}

export async function getDashboardSummary(companyId: string, range: { from?: Date; to?: Date }) {
  const { startDate, endDate, periodStart, periodEnd } = resolvePeriod(range)

  const activeProductConditions = and(
    eq(products.companyId, companyId),
    isNull(products.deletedAt),
    eq(products.active, true),
  )
  const lowStockConditions = and(activeProductConditions, lte(products.currentStock, products.minStock))
  const lossPeriodConditions = and(
    eq(losses.companyId, companyId),
    isNull(losses.cancelledAt),
    gte(losses.lossDate, periodStart),
    lte(losses.lossDate, periodEnd),
  )
  const movementPeriodConditions = and(
    eq(stockMovements.companyId, companyId),
    gte(stockMovements.createdAt, periodStart),
    lte(stockMovements.createdAt, periodEnd),
  )

  const movementDay = sql`date_trunc('day', ${stockMovements.createdAt} at time zone ${BUSINESS_TIME_ZONE_SQL})`
  const movementDayText = sql<string>`to_char(${movementDay}, 'YYYY-MM-DD')`
  const movementQuantity = sql`coalesce(sum(abs(${stockMovements.quantity})), 0)`
  const lossQuantity = sql`coalesce(sum(${losses.quantity}), 0)`
  const stockQuantity = sql`coalesce(sum(${products.currentStock}), 0)`

  const timelineDetail = db
    .select({
      day: movementDayText.as('day'),
      type: stockMovements.type,
      productId: sql<string>`${products.id}`.as('product_id'),
      productName: sql<string>`${products.name}`.as('product_name'),
      unitAbbreviation: sql<string>`${units.abbreviation}`.as('unit_abbreviation'),
      quantity: movementQuantity.as('quantity'),
      rank: sql<number>`row_number() over (
        partition by ${movementDay}, ${stockMovements.type}
        order by ${movementQuantity} desc, ${products.name} asc
      )`.as('rank'),
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .innerJoin(units, eq(units.id, products.unitId))
    .where(movementPeriodConditions)
    .groupBy(movementDay, stockMovements.type, products.id, products.name, units.abbreviation)
    .as('timeline_detail')

  const lossDetail = db
    .select({
      reason: losses.reason,
      productId: sql<string>`${products.id}`.as('product_id'),
      productName: sql<string>`${products.name}`.as('product_name'),
      unitAbbreviation: sql<string>`${units.abbreviation}`.as('unit_abbreviation'),
      quantity: lossQuantity.as('quantity'),
      rank: sql<number>`row_number() over (
        partition by ${losses.reason}
        order by ${lossQuantity} desc, ${products.name} asc
      )`.as('rank'),
    })
    .from(losses)
    .innerJoin(products, eq(products.id, losses.productId))
    .innerJoin(units, eq(units.id, products.unitId))
    .where(lossPeriodConditions)
    .groupBy(losses.reason, products.id, products.name, units.abbreviation)
    .as('loss_detail')

  const categoryStockConditions = and(activeProductConditions, gt(products.currentStock, '0'))

  const categoryDetail = db
    .select({
      categoryId: sql<string>`${categories.id}`.as('category_id'),
      productId: sql<string>`${products.id}`.as('product_id'),
      productName: sql<string>`${products.name}`.as('product_name'),
      unitAbbreviation: sql<string>`${units.abbreviation}`.as('unit_abbreviation'),
      quantity: stockQuantity.as('quantity'),
      rank: sql<number>`row_number() over (
        partition by ${categories.id}
        order by ${stockQuantity} desc, ${products.name} asc
      )`.as('rank'),
    })
    .from(categories)
    .innerJoin(products, eq(products.categoryId, categories.id))
    .innerJoin(units, eq(units.id, products.unitId))
    .where(and(eq(categories.companyId, companyId), isNull(categories.deletedAt), categoryStockConditions))
    .groupBy(categories.id, products.id, products.name, units.abbreviation)
    .as('category_detail')

  const [
    [productSummary],
    [{ lowStockCount }],
    lowStockProducts,
    [lossSummary],
    lossTotals,
    lossTopProducts,
    timelineTotals,
    timelineTopProducts,
    categoryTotals,
    categoryTopProducts,
    recentMovements,
  ] = await Promise.all([
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
        unitId: units.id,
        unitName: units.name,
        unitAbbreviation: units.abbreviation,
        lossesCount: count(),
        productsCount: countDistinct(products.id),
        quantity: lossQuantity.mapWith(Number),
      })
      .from(losses)
      .innerJoin(products, eq(products.id, losses.productId))
      .innerJoin(units, eq(units.id, products.unitId))
      .where(lossPeriodConditions)
      .groupBy(losses.reason, units.id, units.name, units.abbreviation),
    db
      .select()
      .from(lossDetail)
      .where(lte(lossDetail.rank, TOP_PRODUCTS_PER_GROUP))
      .orderBy(lossDetail.reason, lossDetail.rank),
    db
      .select({
        day: movementDayText,
        type: stockMovements.type,
        unitId: units.id,
        unitName: units.name,
        unitAbbreviation: units.abbreviation,
        movementsCount: count(),
        productsCount: countDistinct(products.id),
        quantity: movementQuantity.mapWith(Number),
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .innerJoin(units, eq(units.id, products.unitId))
      .where(movementPeriodConditions)
      .groupBy(movementDay, stockMovements.type, units.id, units.name, units.abbreviation),
    db
      .select()
      .from(timelineDetail)
      .where(lte(timelineDetail.rank, TOP_PRODUCTS_PER_GROUP))
      .orderBy(timelineDetail.day, timelineDetail.type, timelineDetail.rank),

    db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        unitId: units.id,
        unitName: units.name,
        unitAbbreviation: units.abbreviation,
        productCount: countDistinct(products.id),
        productsWithStock: countDistinct(sql`case when ${products.currentStock} > 0 then ${products.id} end`),
        quantity: sql<number>`coalesce(sum(case when ${products.currentStock} > 0 then ${products.currentStock} else 0 end), 0)`.mapWith(Number),
      })
      .from(categories)
      .innerJoin(products, eq(products.categoryId, categories.id))
      .innerJoin(units, eq(units.id, products.unitId))
      .where(and(eq(categories.companyId, companyId), isNull(categories.deletedAt), activeProductConditions))
      .groupBy(categories.id, categories.name, units.id, units.name, units.abbreviation),
    db
      .select()
      .from(categoryDetail)
      .where(lte(categoryDetail.rank, TOP_PRODUCTS_PER_GROUP))
      .orderBy(categoryDetail.categoryId, categoryDetail.rank),
    db.query.stockMovements.findMany({
      where: movementPeriodConditions,
      with: {
        product: true,
        createdByUser: { columns: { id: true, name: true } },
      },
      orderBy: desc(stockMovements.createdAt),
      limit: 10,
    }),
  ])

  type TimelineBucket = {
    entradaCount: number
    perdaCount: number
    ajusteCount: number
    entradaByUnit: QuantityByUnit[]
    perdaByUnit: QuantityByUnit[]
    ajusteByUnit: QuantityByUnit[]
    entradaProductsTotal: number
    perdaProductsTotal: number
    ajusteProductsTotal: number
    entradaProducts: ProductQuantity[]
    perdaProducts: ProductQuantity[]
    ajusteProducts: ProductQuantity[]
  }
  function emptyTimelineBucket(): TimelineBucket {
    return {
      entradaCount: 0,
      perdaCount: 0,
      ajusteCount: 0,
      entradaByUnit: [],
      perdaByUnit: [],
      ajusteByUnit: [],
      entradaProductsTotal: 0,
      perdaProductsTotal: 0,
      ajusteProductsTotal: 0,
      entradaProducts: [],
      perdaProducts: [],
      ajusteProducts: [],
    }
  }

  const timelineByDay = new Map<string, TimelineBucket>()
  const bucketFor = (day: string) => {
    const existing = timelineByDay.get(day)
    if (existing) return existing
    const created = emptyTimelineBucket()
    timelineByDay.set(day, created)
    return created
  }

  for (const row of timelineTotals) {
    const bucket = bucketFor(row.day)
    const quantity = {
      unitId: row.unitId,
      unitName: row.unitName,
      unitAbbreviation: row.unitAbbreviation,
      quantity: row.quantity,
    }
    if (row.type === 'entrada') {
      bucket.entradaCount += row.movementsCount
      bucket.entradaProductsTotal += row.productsCount
      addQuantityByUnit(bucket.entradaByUnit, quantity)
    }
    if (row.type === 'perda') {
      bucket.perdaCount += row.movementsCount
      bucket.perdaProductsTotal += row.productsCount
      addQuantityByUnit(bucket.perdaByUnit, quantity)
    }
    if (row.type === 'ajuste') {
      bucket.ajusteCount += row.movementsCount
      bucket.ajusteProductsTotal += row.productsCount
      addQuantityByUnit(bucket.ajusteByUnit, quantity)
    }
  }

  for (const row of timelineTopProducts) {
    const bucket = bucketFor(row.day)
    const product = {
      productId: row.productId,
      productName: row.productName,
      quantity: Number(row.quantity),
      unitAbbreviation: row.unitAbbreviation,
    }
    if (row.type === 'entrada') bucket.entradaProducts.push(product)
    if (row.type === 'perda') bucket.perdaProducts.push(product)
    if (row.type === 'ajuste') bucket.ajusteProducts.push(product)
  }

  const dayCount = daysBetweenIsoDates(startDate, endDate) + 1
  const movementsTimeline = Array.from({ length: dayCount }, (_, index) => {
    const key = addDaysToIsoDate(startDate, index)
    const bucket = timelineByDay.get(key) ?? emptyTimelineBucket()
    return {
      date: key,
      entradaCount: bucket.entradaCount,
      perdaCount: bucket.perdaCount,
      ajusteCount: bucket.ajusteCount,
      entradaByUnit: bucket.entradaByUnit,
      perdaByUnit: bucket.perdaByUnit,
      ajusteByUnit: bucket.ajusteByUnit,
      entradaProducts: bucket.entradaProducts,
      entradaOtherProductsCount: otherProductsCount(bucket.entradaProductsTotal),
      perdaProducts: bucket.perdaProducts,
      perdaOtherProductsCount: otherProductsCount(bucket.perdaProductsTotal),
      ajusteProducts: bucket.ajusteProducts,
      ajusteOtherProductsCount: otherProductsCount(bucket.ajusteProductsTotal),
    }
  })

  const categoryMap = new Map<
    string,
    {
      categoryId: string
      categoryName: string
      productCount: number
      totalsByUnit: QuantityByUnit[]
      products: ProductQuantity[]
      otherProductsCount: number
    }
  >()
  for (const row of categoryTotals) {
    const category = categoryMap.get(row.categoryId) ?? {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      productCount: 0,
      totalsByUnit: [],
      products: [],
      otherProductsCount: 0,
    }
    category.productCount += row.productCount
    if (row.productsWithStock > 0) {
      addQuantityByUnit(category.totalsByUnit, {
        unitId: row.unitId,
        unitName: row.unitName,
        unitAbbreviation: row.unitAbbreviation,
        quantity: row.quantity,
      })
      category.otherProductsCount += row.productsWithStock
    }
    categoryMap.set(row.categoryId, category)
  }

  for (const row of categoryTopProducts) {
    const category = categoryMap.get(row.categoryId)
    if (!category) continue
    category.products.push({
      productId: row.productId,
      productName: row.productName,
      quantity: Number(row.quantity),
      unitAbbreviation: row.unitAbbreviation,
    })
  }

  const stockByCategory = [...categoryMap.values()]
    .filter((row) => row.productCount > 0)
    .sort((left, right) => right.productCount - left.productCount)
    .map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      productCount: category.productCount,
      totalsByUnit: category.totalsByUnit,
      products: category.products,
      otherProductsCount: otherProductsCount(category.otherProductsCount),
    }))

  const lossReasonMap = new Map<
    string,
    {
      reason: (typeof lossTotals)[number]['reason']
      lossesCount: number
      totalsByUnit: QuantityByUnit[]
      products: ProductQuantity[]
      productsTotal: number
    }
  >()
  const lossesByUnitMap = new Map<string, QuantityByUnit>()
  for (const row of lossTotals) {
    const reason = lossReasonMap.get(row.reason) ?? {
      reason: row.reason,
      lossesCount: 0,
      totalsByUnit: [],
      products: [],
      productsTotal: 0,
    }
    reason.lossesCount += row.lossesCount
    reason.productsTotal += row.productsCount
    addQuantityByUnit(reason.totalsByUnit, {
      unitId: row.unitId,
      unitName: row.unitName,
      unitAbbreviation: row.unitAbbreviation,
      quantity: row.quantity,
    })
    lossReasonMap.set(row.reason, reason)

    const total = lossesByUnitMap.get(row.unitId) ?? {
      unitId: row.unitId,
      unitName: row.unitName,
      unitAbbreviation: row.unitAbbreviation,
      quantity: 0,
    }
    total.quantity += row.quantity
    lossesByUnitMap.set(row.unitId, total)
  }

  for (const row of lossTopProducts) {
    const reason = lossReasonMap.get(row.reason)
    if (!reason) continue
    reason.products.push({
      productId: row.productId,
      productName: row.productName,
      quantity: Number(row.quantity),
      unitAbbreviation: row.unitAbbreviation,
    })
  }

  const lossesByReason = [...lossReasonMap.values()].map((reason) => ({
    reason: reason.reason,
    lossesCount: reason.lossesCount,
    totalsByUnit: reason.totalsByUnit,
    products: reason.products,
    otherProductsCount: otherProductsCount(reason.productsTotal),
  }))

  return {
    totalProducts: productSummary.totalProducts,
    lowStockCount,
    lowStockProducts,
    stockValue: productSummary.stockValue,
    periodFrom: startDate,
    periodTo: endDate,
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
