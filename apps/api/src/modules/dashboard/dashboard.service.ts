import { and, asc, count, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'
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

/**
 * Fuso do negócio embutido como literal, e não como parâmetro do driver: a mesma
 * expressão precisa sair idêntica no `select` e no `group by`, e dois placeholders
 * distintos (`$1`/`$2`) fariam o Postgres tratá-los como expressões diferentes.
 * O valor é uma constante nossa, nunca entrada do usuário.
 */
const BUSINESS_TIME_ZONE_SQL = sql.raw(`'${APP_TIME_ZONE}'`)

/**
 * Quantos produtos cada agrupamento do painel devolve. O detalhamento por
 * produto só aparece nos tooltips, que mostram uns poucos itens — mandar a
 * lista inteira inflava a resposta sem nada aparecer na tela: 90 dias com
 * algumas centenas de produtos girando geravam dezenas de milhares de objetos
 * num único JSON, e esse endpoint não é paginado.
 */
const TOP_PRODUCTS_PER_GROUP = 5

/**
 * Resolve o período em **datas civis** do fuso do negócio, e não em instantes do
 * relógio do servidor. O gráfico é por dia: decidir os limites em UTC empurrava
 * tudo que acontece depois das 21h de Brasília para o dia seguinte da timeline.
 */
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

  const movementDay = sql`date_trunc('day', ${stockMovements.createdAt} at time zone ${BUSINESS_TIME_ZONE_SQL})`
  const timelineRows = await db
    .select({
      day: sql<string>`to_char(${movementDay}, 'YYYY-MM-DD')`,
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
      movementDay,
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
  /**
   * Corta o detalhamento aos produtos de maior quantidade e informa quantos
   * ficaram de fora, para o tooltip conseguir escrever "+ N outros produtos"
   * sem receber a lista completa.
   */
  function topProducts(products: ProductQuantity[]) {
    if (products.length <= TOP_PRODUCTS_PER_GROUP) return { products, otherProductsCount: 0 }
    const ordered = [...products].sort((left, right) => right.quantity - left.quantity)
    return {
      products: ordered.slice(0, TOP_PRODUCTS_PER_GROUP),
      otherProductsCount: products.length - TOP_PRODUCTS_PER_GROUP,
    }
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
  function emptyTimelineBucket(): TimelineBucket {
    return {
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
  }
  const timelineByDay = new Map<string, TimelineBucket>()
  for (const row of timelineRows) {
    const bucket = timelineByDay.get(row.day) ?? emptyTimelineBucket()
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

  const dayCount = daysBetweenIsoDates(startDate, endDate) + 1
  const movementsTimeline = Array.from({ length: dayCount }, (_, index) => {
    const key = addDaysToIsoDate(startDate, index)
    const bucket = timelineByDay.get(key) ?? emptyTimelineBucket()
    const entrada = topProducts(bucket.entradaProducts)
    const perda = topProducts(bucket.perdaProducts)
    const ajuste = topProducts(bucket.ajusteProducts)
    return {
      date: key,
      entradaCount: bucket.entradaCount,
      perdaCount: bucket.perdaCount,
      ajusteCount: bucket.ajusteCount,
      entradaByUnit: bucket.entradaByUnit,
      perdaByUnit: bucket.perdaByUnit,
      ajusteByUnit: bucket.ajusteByUnit,
      entradaProducts: entrada.products,
      entradaOtherProductsCount: entrada.otherProductsCount,
      perdaProducts: perda.products,
      perdaOtherProductsCount: perda.otherProductsCount,
      ajusteProducts: ajuste.products,
      ajusteOtherProductsCount: ajuste.otherProductsCount,
    }
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
    .map(({ products, ...category }) => {
      const top = topProducts(products)
      return { ...category, products: top.products, otherProductsCount: top.otherProductsCount }
    })

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
  const lossesByReason = [...lossReasonMap.values()].map(({ products, ...reason }) => {
    const top = topProducts(products)
    return { ...reason, products: top.products, otherProductsCount: top.otherProductsCount }
  })
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
