import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories, products, units } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { CreateProductInput, UpdateProductInput } from './products.schema.js'

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

export async function listProducts(companyId: string) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.companyId, companyId), isNull(products.deletedAt)))
    .orderBy(asc(products.name))
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
