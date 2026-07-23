import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { units } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { CreateUnitInput, UpdateUnitInput } from './units.schema.js'

async function assertUniqueName(companyId: string, name: string, excludeId?: string) {
  const conditions = [
    eq(units.companyId, companyId),
    isNull(units.deletedAt),
    sql`lower(${units.name}) = lower(${name})`,
  ]
  if (excludeId) conditions.push(ne(units.id, excludeId))

  const [existing] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(...conditions))

  if (existing) throw AppError.duplicate('name', 'Já existe uma unidade com esse nome')
}

async function assertUniqueAbbreviation(companyId: string, abbreviation: string, excludeId?: string) {
  const conditions = [
    eq(units.companyId, companyId),
    isNull(units.deletedAt),
    sql`lower(${units.abbreviation}) = lower(${abbreviation})`,
  ]
  if (excludeId) conditions.push(ne(units.id, excludeId))

  const [existing] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(...conditions))

  if (existing) throw AppError.duplicate('abbreviation', 'Já existe uma unidade com essa abreviação')
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
