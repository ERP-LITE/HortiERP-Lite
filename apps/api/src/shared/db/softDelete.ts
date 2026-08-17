import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'
import { db } from '../../db/client.js'
import { recordActivitiesSafe, type ActivityEntity } from './recordActivity.js'

interface SoftDeletableColumns {
  id: AnyPgColumn
  companyId: AnyPgColumn
  deletedAt: AnyPgColumn
  updatedBy: AnyPgColumn
  updatedAt: AnyPgColumn
}

type SoftDeletableTable = PgTable & SoftDeletableColumns

type NamedSoftDeletableTable = SoftDeletableTable & { name: AnyPgColumn }

// o drizzle infere as chaves aceitas em .set() a partir do tipo concreto da tabela, algo que o TS
// não consegue verificar de forma genérica contra a interface SoftDeletableTable acima — o `as any`
// é seguro aqui porque toda chamada passa uma PgTable real, que satisfaz essas colunas em runtime.
export async function softDeleteById<T extends SoftDeletableTable>(
  table: T,
  companyId: string,
  userId: string,
  id: string,
  extraSet: Record<string, unknown> = {},
) {
  await db
    .update(table)
    .set({ deletedAt: new Date(), updatedBy: userId, updatedAt: new Date(), ...extraSet } as any)
    .where(and(eq(table.id, id), eq(table.companyId, companyId)))
}

export async function softDeleteByIds<T extends SoftDeletableTable>(
  table: T,
  companyId: string,
  userId: string,
  ids: string[],
  extraSet: Record<string, unknown> = {},
) {
  const deleted = await db
    .update(table)
    .set({ deletedAt: new Date(), updatedBy: userId, updatedAt: new Date(), ...extraSet } as any)
    .where(and(eq(table.companyId, companyId), inArray(table.id, ids), isNull(table.deletedAt)))
    .returning({ id: table.id })

  return { deleted: deleted.length }
}

export async function softDeleteManyWithActivity(options: {
  table: NamedSoftDeletableTable
  companyId: string
  userId: string
  ids: string[]
  entity: ActivityEntity
  extraSet?: Record<string, unknown>
}) {
  const { table, companyId, userId, ids, entity, extraSet = {} } = options

  const removidos = await db
    .select({ id: table.id, label: table.name })
    .from(table as PgTable)
    .where(and(eq(table.companyId, companyId), inArray(table.id, ids), isNull(table.deletedAt)))

  const result = await softDeleteByIds(table, companyId, userId, ids, extraSet)

  await recordActivitiesSafe(
    removidos.map((item) => ({
      companyId,
      actorId: userId,
      action: 'excluiu' as const,
      entity,
      entityId: item.id as string,
      entityLabel: item.label as string,
    })),
  )

  return result
}
