import { and, asc, count, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { assertUniqueField } from '../../shared/db/assertUniqueField.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import type { CreateCategoryInput, ListCategoriesQuery, UpdateCategoryInput } from './categories.schema.js'

function assertUniqueName(companyId: string, name: string, excludeId?: string) {
  return assertUniqueField({
    table: categories,
    idColumn: categories.id,
    valueColumn: categories.name,
    companyIdColumn: categories.companyId,
    companyId,
    deletedAtColumn: categories.deletedAt,
    value: name,
    excludeId,
    field: 'name',
    message: 'Já existe uma categoria com esse nome',
  })
}

export async function listCategories(companyId: string, query: ListCategoriesQuery) {
  const conditions = [eq(categories.companyId, companyId), isNull(categories.deletedAt)]
  if (query.search) {
    conditions.push(or(ilike(categories.name, `%${query.search}%`), ilike(categories.description, `%${query.search}%`))!)
  }
  const where = and(...conditions)

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(where)
      .orderBy(asc(categories.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(categories).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
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
  await assertUniqueName(companyId, data.name)

  const [category] = await db
    .insert(categories)
    .values({ ...data, companyId, createdBy: userId })
    .returning()

  return category
}

export async function updateCategory(companyId: string, userId: string, id: string, data: UpdateCategoryInput) {
  await getCategory(companyId, id)
  if (data.name) await assertUniqueName(companyId, data.name, id)

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

export async function deleteCategories(companyId: string, userId: string, ids: string[]) {
  const deleted = await db
    .update(categories)
    .set({ deletedAt: new Date(), updatedBy: userId, updatedAt: new Date() })
    .where(and(eq(categories.companyId, companyId), inArray(categories.id, ids), isNull(categories.deletedAt)))
    .returning({ id: categories.id })

  return { deleted: deleted.length }
}
