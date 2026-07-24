import { and, asc, count, eq, ilike, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories, products, units } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { assertUniqueField } from '../../shared/db/assertUniqueField.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import type { CreateProductInput, ListProductsQuery, UpdateProductInput } from './products.schema.js'

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

function assertUniqueSku(companyId: string, sku: string | undefined, excludeId?: string) {
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

async function assertCategoryAndUnitBelongToCompany(
  companyId: string,
  categoryId?: string,
  unitId?: string,
) {
  if (categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.companyId, companyId), isNull(categories.deletedAt)))

    if (!category) throw AppError.notFound('Categoria não encontrada')
  }

  if (unitId) {
    const [unit] = await db
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.id, unitId), eq(units.companyId, companyId), isNull(units.deletedAt)))

    if (!unit) throw AppError.notFound('Unidade de medida não encontrada')
  }
}

export async function listProducts(companyId: string, query: ListProductsQuery) {
  const conditions = [eq(products.companyId, companyId), isNull(products.deletedAt)]
  if (query.search) conditions.push(ilike(products.name, `%${query.search}%`))
  if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId))
  if (query.active !== undefined) conditions.push(eq(products.active, query.active))
  const where = and(...conditions)

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(asc(products.name))
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
  await assertCategoryAndUnitBelongToCompany(companyId, data.categoryId, data.unitId)
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

  return product
}

export async function updateProduct(companyId: string, userId: string, id: string, data: UpdateProductInput) {
  await getProduct(companyId, id)
  await assertCategoryAndUnitBelongToCompany(companyId, data.categoryId, data.unitId)
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
      ...(data.costPrice !== undefined && { costPrice: data.costPrice.toString() }),
      ...(data.salePrice !== undefined && { salePrice: data.salePrice.toString() }),
      ...(data.minStock !== undefined && { minStock: data.minStock.toString() }),
      ...(data.active !== undefined && { active: data.active }),
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, id), eq(products.companyId, companyId)))
    .returning()

  return product
}

export async function deleteProduct(companyId: string, userId: string, id: string) {
  await getProduct(companyId, id)

  await db
    .update(products)
    .set({ deletedAt: new Date(), updatedBy: userId })
    .where(and(eq(products.id, id), eq(products.companyId, companyId)))
}
