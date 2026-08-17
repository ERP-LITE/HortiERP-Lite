import { asc, desc, sql, type SQL, type SQLWrapper } from 'drizzle-orm'

export type SortOrder = 'asc' | 'desc'

export function orderByColumn(
  column: SQLWrapper,
  sortOrder: SortOrder | undefined,
  defaultOrder: SortOrder = 'asc',
): SQL {
  return (sortOrder ?? defaultOrder) === 'asc' ? sql`${asc(column)} nulls last` : sql`${desc(column)} nulls last`
}

export function orderByLabeledEnum(
  column: SQLWrapper,
  labelOrder: readonly string[],
  sortOrder: SortOrder | undefined,
  defaultOrder: SortOrder = 'asc',
): SQL {
  const branches = labelOrder.map((value, index) => sql`when ${column}::text = ${value} then ${index}`)
  const rank = sql`case ${sql.join(branches, sql` `)} else ${labelOrder.length} end`
  return (sortOrder ?? defaultOrder) === 'asc' ? sql`${rank} asc` : sql`${rank} desc`
}

/** Ordem alfabética dos rótulos de `loss_reason` mostrados na tela de perdas. */
export const LOSS_REASON_LABEL_ORDER = ['avariado', 'erro_operacional', 'outro', 'roubo_furto', 'vencido'] as const

/** Ordem alfabética dos rótulos de `movement_type` mostrados no histórico de estoque. */
export const MOVEMENT_TYPE_LABEL_ORDER = ['ajuste', 'entrada', 'perda'] as const
