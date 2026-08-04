import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { units } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { assertUniqueField } from '../../shared/db/assertUniqueField.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { softDeleteById, softDeleteByIds } from '../../shared/db/softDelete.js'
import type { CreateUnitInput, ListUnitsQuery, UpdateUnitInput } from './units.schema.js'

function assertUniqueName(companyId: string, name: string, excludeId?: string) {
  return assertUniqueField({
    table: units,
    idColumn: units.id,
    valueColumn: units.name,
    companyIdColumn: units.companyId,
    companyId,
    deletedAtColumn: units.deletedAt,
    value: name,
    excludeId,
    field: 'name',
    message: 'Já existe uma unidade com esse nome',
  })
}

function assertUniqueAbbreviation(companyId: string, abbreviation: string, excludeId?: string) {
  return assertUniqueField({
    table: units,
    idColumn: units.id,
    valueColumn: units.abbreviation,
    companyIdColumn: units.companyId,
    companyId,
    deletedAtColumn: units.deletedAt,
    value: abbreviation,
    excludeId,
    field: 'abbreviation',
    message: 'Já existe uma unidade com essa abreviação',
  })
}

export async function listUnits(companyId: string, query: ListUnitsQuery) {
  const conditions = [eq(units.companyId, companyId), isNull(units.deletedAt)]
  if (query.search) {
    conditions.push(or(ilike(units.name, `%${query.search}%`), ilike(units.abbreviation, `%${query.search}%`))!)
  }
  const where = and(...conditions)

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(units)
      .where(where)
      .orderBy(asc(units.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(units).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function getUnit(companyId: string, id: string) {
  const [unit] = await db
    .select()
    .from(units)
    .where(and(eq(units.id, id), eq(units.companyId, companyId), isNull(units.deletedAt)))

  if (!unit) throw AppError.notFound('Unidade de medida não encontrada')

  return unit
}

export async function createUnit(companyId: string, userId: string, data: CreateUnitInput) {
  await assertUniqueName(companyId, data.name)
  await assertUniqueAbbreviation(companyId, data.abbreviation)

  const [unit] = await db
    .insert(units)
    .values({ ...data, companyId, createdBy: userId })
    .returning()

  return unit
}

export async function updateUnit(companyId: string, userId: string, id: string, data: UpdateUnitInput) {
  await getUnit(companyId, id)
  if (data.name) await assertUniqueName(companyId, data.name, id)
  if (data.abbreviation) await assertUniqueAbbreviation(companyId, data.abbreviation, id)

  const [unit] = await db
    .update(units)
    .set({ ...data, updatedBy: userId, updatedAt: new Date() })
    .where(and(eq(units.id, id), eq(units.companyId, companyId)))
    .returning()

  return unit
}

export async function deleteUnit(companyId: string, userId: string, id: string) {
  await getUnit(companyId, id)
  await softDeleteById(units, companyId, userId, id)
}

export async function deleteUnits(companyId: string, userId: string, ids: string[]) {
  return softDeleteByIds(units, companyId, userId, ids)
}
