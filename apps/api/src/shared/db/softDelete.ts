import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'
import { db } from '../../db/client.js'

interface SoftDeletableColumns {
  id: AnyPgColumn
  companyId: AnyPgColumn
  deletedAt: AnyPgColumn
  updatedBy: AnyPgColumn
  updatedAt: AnyPgColumn
}

type SoftDeletableTable = PgTable & SoftDeletableColumns

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
