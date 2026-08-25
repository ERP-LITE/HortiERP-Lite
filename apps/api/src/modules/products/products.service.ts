import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm'
import { orderByColumn } from '../../shared/db/sorting.js'
import { db } from '../../db/client.js'
import { categories, products, stockMovements, units } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { assertUniqueField } from '../../shared/db/assertUniqueField.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { softDeleteById, softDeleteManyWithActivity } from '../../shared/db/softDelete.js'
import { recordActivity, recordActivitySafe } from '../../shared/db/recordActivity.js'
import type {
  CreateProductInput,
  ImportProductsInput,
  ListProductsQuery,
  UpdateProductInput,
} from './products.schema.js'

function assertUniqueName(companyId: string, name: string, excludeId?: string) {
  return assertUniqueField({
    table: products,
    idColumn: products.id,
    valueColumn: products.name,
    companyIdColumn: products.companyId,
    companyId,
    deletedAtColumn: products.deletedAt,
    value: name,
    excludeId,
    field: 'name',
    message: 'Já existe um produto com esse nome',
  })
}

function assertUniqueSku(companyId: string, sku: string | null | undefined, excludeId?: string) {
  if (!sku) return

  return assertUniqueField({
    table: products,
    idColumn: products.id,
    valueColumn: products.sku,
    companyIdColumn: products.companyId,
    companyId,
    deletedAtColumn: products.deletedAt,
    value: sku,
    excludeId,
    field: 'sku',
    message: 'Já existe um produto com esse SKU',
  })
}

async function assertCategoryAndUnitUsable(
  companyId: string,
  categoryId?: string,
  unitId?: string,
  current?: { categoryId: string; unitId: string },
) {
  if (categoryId) {
    const [category] = await db
      .select({ id: categories.id, active: categories.active })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.companyId, companyId), isNull(categories.deletedAt)))

    if (!category) throw AppError.notFound('Categoria não encontrada')
    if (!category.active && categoryId !== current?.categoryId) {
      throw AppError.conflict('Esta categoria está inativa. Reative a categoria ou escolha outra.')
    }
  }

  if (unitId) {
    const [unit] = await db
      .select({ id: units.id, active: units.active })
      .from(units)
      .where(and(eq(units.id, unitId), eq(units.companyId, companyId), isNull(units.deletedAt)))

    if (!unit) throw AppError.notFound('Unidade de medida não encontrada')
    if (!unit.active && unitId !== current?.unitId) {
      throw AppError.conflict('Esta unidade está inativa. Reative a unidade ou escolha outra.')
    }
  }
}

export async function listProducts(companyId: string, query: ListProductsQuery) {
  const conditions = [eq(products.companyId, companyId), isNull(products.deletedAt)]
  if (query.search) {
    conditions.push(
      or(
        ilike(products.name, `%${query.search}%`),
        ilike(products.sku, `%${query.search}%`),
        ilike(products.barcode, `%${query.search}%`),
      )!,
    )
  }
  if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId))
  if (query.unitId) conditions.push(eq(products.unitId, query.unitId))
  if (query.active !== undefined) conditions.push(eq(products.active, query.active))
  const where = and(...conditions)
  const orderBy = orderByColumn(query.sortBy ? products[query.sortBy] : products.name, query.sortOrder)

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(orderBy, asc(products.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(products).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function getProduct(companyId: string, id: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.companyId, companyId), isNull(products.deletedAt)))

  if (!product) throw AppError.notFound('Produto não encontrado')

  return product
}

export async function createProduct(companyId: string, userId: string, data: CreateProductInput) {
  await assertCategoryAndUnitUsable(companyId, data.categoryId, data.unitId)
  await assertUniqueName(companyId, data.name)
  await assertUniqueSku(companyId, data.sku)

  const [product] = await db
    .insert(products)
    .values({
      companyId,
      categoryId: data.categoryId,
      unitId: data.unitId,
      name: data.name,
      sku: data.sku,
      barcode: data.barcode,
      costPrice: data.costPrice?.toString(),
      salePrice: data.salePrice?.toString(),
      minStock: data.minStock.toString(),
      active: data.active,
      createdBy: userId,
    })
    .returning()

  await recordActivitySafe({
    companyId,
    actorId: userId,
    action: 'criou',
    entity: 'produto',
    entityId: product.id,
    entityLabel: product.name,
  })

  return product
}

export async function updateProduct(companyId: string, userId: string, id: string, data: UpdateProductInput) {
  const atual = await getProduct(companyId, id)
  await assertCategoryAndUnitUsable(companyId, data.categoryId, data.unitId, atual)
  if (data.name) await assertUniqueName(companyId, data.name, id)
  if (data.sku !== undefined) await assertUniqueSku(companyId, data.sku, id)

  const [product] = await db
    .update(products)
    .set({
      ...(data.categoryId && { categoryId: data.categoryId }),
      ...(data.unitId && { unitId: data.unitId }),
      ...(data.name && { name: data.name }),
      ...(data.sku !== undefined && { sku: data.sku }),
      ...(data.barcode !== undefined && { barcode: data.barcode }),
      // `null` limpa o campo; `?.toString()` viraria `undefined` e o Drizzle ignoraria a coluna.
      ...(data.costPrice !== undefined && { costPrice: data.costPrice === null ? null : data.costPrice.toString() }),
      ...(data.salePrice !== undefined && { salePrice: data.salePrice === null ? null : data.salePrice.toString() }),
      ...(data.minStock !== undefined && { minStock: data.minStock.toString() }),
      ...(data.active !== undefined && { active: data.active }),
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, id), eq(products.companyId, companyId)))
    .returning()

  await recordActivitySafe({
    companyId,
    actorId: userId,
    action: 'alterou',
    entity: 'produto',
    entityId: product.id,
    entityLabel: product.name,
  })

  return product
}

const MAX_REPORTED_ROWS = 200

type ImportRowError = { line: number; name: string; errors: string[] }

function parseDecimal(raw: string | undefined) {
  const value = (raw ?? '').trim()
  if (!value) return { ok: true as const, value: undefined }

  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')
  let normalized = value
  if (lastComma >= 0 || lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const group = decimal === ',' ? '.' : ','
    normalized = value.split(group).join('').replace(decimal, '.')
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return { ok: false as const, value: undefined }
  return { ok: true as const, value: parsed }
}

const ACTIVE_TRUE = new Set(['sim', 's', 'true', 'verdadeiro', '1', 'ativo'])
const ACTIVE_FALSE = new Set(['nao', 'não', 'n', 'false', 'falso', '0', 'inativo'])

function parseActive(raw: string | undefined) {
  const value = (raw ?? '').trim().toLocaleLowerCase('pt-BR')
  if (!value || ACTIVE_TRUE.has(value)) return { ok: true as const, value: true }
  if (ACTIVE_FALSE.has(value)) return { ok: true as const, value: false }
  return { ok: false as const, value: true }
}

function buildAbbreviation(name: string, taken: Set<string>) {
  const base = (name.slice(0, 10).trim() || 'un')
  let candidate = base
  let suffix = 1
  while (taken.has(candidate.toLocaleLowerCase('pt-BR'))) {
    const suffixText = String(++suffix)
    candidate = `${base.slice(0, 10 - suffixText.length)}${suffixText}`
  }
  taken.add(candidate.toLocaleLowerCase('pt-BR'))
  return candidate
}

const lower = (value: string) => value.trim().toLocaleLowerCase('pt-BR')

export async function importProducts(companyId: string, userId: string, input: ImportProductsInput) {
  const [existingCategories, existingUnits, existingProducts] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, active: categories.active })
      .from(categories)
      .where(and(eq(categories.companyId, companyId), isNull(categories.deletedAt))),
    db
      .select({ id: units.id, name: units.name, abbreviation: units.abbreviation, active: units.active })
      .from(units)
      .where(and(eq(units.companyId, companyId), isNull(units.deletedAt))),
    db
      .select({ name: products.name, sku: products.sku })
      .from(products)
      .where(and(eq(products.companyId, companyId), isNull(products.deletedAt))),
  ])

  const categoryByName = new Map(existingCategories.map((item) => [lower(item.name), item.id]))
  const unitByName = new Map<string, string>()
  for (const unit of existingUnits) {
    unitByName.set(lower(unit.name), unit.id)
    if (!unitByName.has(lower(unit.abbreviation))) unitByName.set(lower(unit.abbreviation), unit.id)
  }
  const inactiveCategories = new Set(existingCategories.filter((item) => !item.active).map((item) => lower(item.name)))
  const inactiveUnits = new Set(
    existingUnits.filter((item) => !item.active).flatMap((item) => [lower(item.name), lower(item.abbreviation)]),
  )

  const takenNames = new Set(existingProducts.map((item) => lower(item.name)))
  const takenSkus = new Set(existingProducts.filter((item) => item.sku).map((item) => lower(item.sku!)))
  const takenAbbreviations = new Set(existingUnits.map((item) => lower(item.abbreviation)))

  const newCategories = new Map<string, string>()
  const newUnits = new Map<string, string>()
  const errors: ImportRowError[] = []
  const accepted: {
    line: number
    name: string
    categoryName: string
    unitName: string
    categoryKey: string
    unitKey: string
    sku?: string
    barcode?: string
    costPrice?: number
    salePrice?: number
    minStock: number
    initialStock: number
    active: boolean
  }[] = []

  for (const row of input.rows) {
    const rowErrors: string[] = []
    const name = row.name.trim()
    const categoryName = row.categoryName.trim()
    const unitName = row.unitName.trim()
    const sku = row.sku?.trim() || undefined
    const barcode = row.barcode?.trim() || undefined

    if (!name) rowErrors.push('Nome é obrigatório')
    else if (takenNames.has(lower(name))) rowErrors.push(`Já existe um produto chamado "${name}"`)

    if (!categoryName) rowErrors.push('Categoria é obrigatória')
    else if (!categoryByName.has(lower(categoryName)) && !newCategories.has(lower(categoryName))) {
      if (input.createMissingRefs) newCategories.set(lower(categoryName), categoryName)
      else rowErrors.push(`Categoria "${categoryName}" não existe`)
    }

    if (!unitName) rowErrors.push('Unidade é obrigatória')
    else if (!unitByName.has(lower(unitName)) && !newUnits.has(lower(unitName))) {
      if (input.createMissingRefs) newUnits.set(lower(unitName), unitName)
      else rowErrors.push(`Unidade "${unitName}" não existe`)
    }

    if (sku && takenSkus.has(lower(sku))) rowErrors.push(`O código "${sku}" já está em uso`)

    const costPrice = parseDecimal(row.costPrice)
    if (!costPrice.ok) rowErrors.push('Custo inválido')
    const salePrice = parseDecimal(row.salePrice)
    if (!salePrice.ok) rowErrors.push('Preço de venda inválido')
    const minStock = parseDecimal(row.minStock)
    if (!minStock.ok) rowErrors.push('Estoque mínimo inválido')
    const initialStock = parseDecimal(row.currentStock)
    if (!initialStock.ok) rowErrors.push('Estoque atual inválido')
    const active = parseActive(row.active)
    if (!active.ok) rowErrors.push('Situação inválida (use "sim" ou "não")')

    if (rowErrors.length > 0) {
      if (errors.length < MAX_REPORTED_ROWS) errors.push({ line: row.line, name, errors: rowErrors })
      continue
    }

    takenNames.add(lower(name))
    if (sku) takenSkus.add(lower(sku))

    accepted.push({
      line: row.line,
      name,
      categoryName,
      unitName,
      categoryKey: lower(categoryName),
      unitKey: lower(unitName),
      sku,
      barcode,
      costPrice: costPrice.value,
      salePrice: salePrice.value,
      minStock: minStock.value ?? 0,
      initialStock: initialStock.value ?? 0,
      active: active.value,
    })
  }

  // Categoria/unidade nova só entra na conta se alguma linha aceita usa. Uma linha recusada podia
  // ser a única a citar aquela categoria, e numa importação parcial ela seria criada sem produto.
  const usedCategoryKeys = new Set(accepted.map((item) => item.categoryKey))
  const usedUnitKeys = new Set(accepted.map((item) => item.unitKey))
  for (const key of [...newCategories.keys()]) if (!usedCategoryKeys.has(key)) newCategories.delete(key)
  for (const key of [...newUnits.keys()]) if (!usedUnitKeys.has(key)) newUnits.delete(key)

  const comEstoque = accepted.filter((item) => item.initialStock > 0)

  const summary = {
    total: input.rows.length,
    valid: accepted.length,
    invalid: input.rows.length - accepted.length,
    imported: 0,
    withInitialStock: comEstoque.length,
    initialStockWithoutCost: comEstoque.filter((item) => !item.costPrice).length,
    omittedErrors: Math.max(0, input.rows.length - accepted.length - errors.length),
    newCategories: [...newCategories.values()],
    newUnits: [...newUnits.values()],
    inactive: accepted.filter((item) => !item.active).length,
    initialStockValue:
      Math.round(comEstoque.reduce((total, item) => total + item.initialStock * (item.costPrice ?? 0), 0) * 100) / 100,
  }

  const preview = accepted.slice(0, MAX_REPORTED_ROWS).map((item) => ({
    line: item.line,
    name: item.name,
    categoryName: item.categoryName,
    unitName: item.unitName,
    sku: item.sku ?? null,
    barcode: item.barcode ?? null,
    costPrice: item.costPrice ?? null,
    salePrice: item.salePrice ?? null,
    minStock: item.minStock,
    initialStock: item.initialStock,
    active: item.active,
    newCategory: newCategories.has(item.categoryKey),
    newUnit: newUnits.has(item.unitKey),
    inactiveCategory: inactiveCategories.has(item.categoryKey),
    inactiveUnit: inactiveUnits.has(item.unitKey),
  }))
  const omittedPreview = Math.max(0, accepted.length - preview.length)

  const blockedByErrors = summary.invalid > 0 && !input.skipInvalid
  if (input.dryRun || blockedByErrors || summary.valid === 0) {
    return { summary, errors, preview, omittedPreview }
  }

  await db.transaction(async (tx) => {
    for (const [key, name] of newCategories) {
      const [created] = await tx
        .insert(categories)
        .values({ companyId, name, createdBy: userId })
        .returning({ id: categories.id })
      categoryByName.set(key, created.id)
    }

    for (const [key, name] of newUnits) {
      const [created] = await tx
        .insert(units)
        .values({ companyId, name, abbreviation: buildAbbreviation(name, takenAbbreviations), createdBy: userId })
        .returning({ id: units.id })
      unitByName.set(key, created.id)
    }

    const values = accepted.map((item) => ({
      companyId,
      categoryId: categoryByName.get(item.categoryKey)!,
      unitId: unitByName.get(item.unitKey)!,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      costPrice: item.costPrice?.toString(),
      salePrice: item.salePrice?.toString(),
      minStock: item.minStock.toString(),
      currentStock: item.initialStock.toString(),
      active: item.active,
      createdBy: userId,
    }))

    const createdIdByName = new Map<string, string>()
    for (let index = 0; index < values.length; index += 500) {
      const inserted = await tx
        .insert(products)
        .values(values.slice(index, index + 500))
        .returning({ id: products.id, name: products.name })
      for (const item of inserted) createdIdByName.set(lower(item.name), item.id)
    }

    const initialMovements = comEstoque.flatMap((item) => {
      const productId = createdIdByName.get(lower(item.name))
      if (!productId) return []
      return [
        {
          companyId,
          productId,
          type: 'ajuste' as const,
          quantity: item.initialStock.toString(),
          balanceAfter: item.initialStock.toString(),
          referenceType: 'import',
          referenceId: productId,
          notes: 'Carga inicial de estoque por planilha',
          createdBy: userId,
        },
      ]
    })

    for (let index = 0; index < initialMovements.length; index += 500) {
      await tx.insert(stockMovements).values(initialMovements.slice(index, index + 500))
    }

    await recordActivity(
      {
        companyId,
        actorId: userId,
        action: 'importou',
        entity: 'produto',
        entityLabel: `${accepted.length} produto(s) por planilha`,
        details: {
          produtos: accepted.length,
          comEstoqueInicial: comEstoque.length,
          categoriasCriadas: [...newCategories.values()],
          unidadesCriadas: [...newUnits.values()],
        },
      },
      tx,
    )
  })

  summary.imported = accepted.length
  return { summary, errors, preview, omittedPreview }
}

export async function deleteProduct(companyId: string, userId: string, id: string) {
  const product = await getProduct(companyId, id)
  await softDeleteById(products, companyId, userId, id)
  await recordActivitySafe({
    companyId,
    actorId: userId,
    action: 'excluiu',
    entity: 'produto',
    entityId: id,
    entityLabel: product.name,
  })
}

export async function deleteProducts(companyId: string, userId: string, ids: string[]) {
  return softDeleteManyWithActivity({ table: products, companyId, userId, ids, entity: 'produto' })
}
