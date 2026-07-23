import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schema.js'

export async function listCategories(companyId: string) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.companyId, companyId), isNull(categories.deletedAt)))
    .orderBy(asc(categories.name))
}

export async function getCategory(companyId: string, id: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.companyId, companyId), isNull(categories.deletedAt)))

  if (!category) throw AppError.notFound('Categoria não encontrada')

  return category
}

export async function createCategory(companyId: string, userId: string, data: CreateCategoryInput) {
  const [category] = await db
    .insert(categories)
    .values({ ...data, companyId, createdBy: userId })
    .returning()

  return category
}

export async function updateCategory(companyId: string, userId: string, id: string, data: UpdateCategoryInput) {
  await getCategory(companyId, id)

  const [category] = await db
    .update(categories)
    .set({ ...data, updatedBy: userId, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.companyId, companyId)))
    .returning()

  return category
}

export async function deleteCategory(companyId: string, userId: string, id: string) {
  await getCategory(companyId, id)

  await db
    .update(categories)
    .set({ deletedAt: new Date(), updatedBy: userId })
    .where(and(eq(categories.id, id), eq(categories.companyId, companyId)))
}
