import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { units } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { assertUniqueField } from '../../shared/db/assertUniqueField.js'
import type { CreateUnitInput, UpdateUnitInput } from './units.schema.js'

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

export async function listUnits(companyId: string) {
  return db
    .select()
    .from(units)
    .where(and(eq(units.companyId, companyId), isNull(units.deletedAt)))
    .orderBy(asc(units.name))
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

  await db
    .update(units)
    .set({ deletedAt: new Date(), updatedBy: userId })
    .where(and(eq(units.id, id), eq(units.companyId, companyId)))
}
