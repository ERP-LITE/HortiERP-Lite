import { asc, desc, sql, type SQL, type SQLWrapper } from 'drizzle-orm'

export type SortOrder = 'asc' | 'desc'

/**
 * `nulls last` só entra onde a coluna aceita nulo. Em coluna obrigatória ele não muda o resultado e
 * ainda custa caro: como o padrão do Postgres em `desc` é `nulls first`, pedir `nulls last` faz a
 * ordenação deixar de casar com o índice, e a listagem passa a varrer a tabela inteira para ordenar
 * 15 linhas. Expressão crua (`sql`) não sabe dizer se aceita nulo, e por segurança mantém o sufixo.
 * Ver docs/decisoes-arquiteturais.md.
 */
function aceitaNulo(column: SQLWrapper) {
  return (column as { notNull?: boolean }).notNull !== true
}

export function orderByColumn(
  column: SQLWrapper,
  sortOrder: SortOrder | undefined,
  defaultOrder: SortOrder = 'asc',
): SQL {
  const ordenacao = (sortOrder ?? defaultOrder) === 'asc' ? asc(column) : desc(column)
  return aceitaNulo(column) ? sql`${ordenacao} nulls last` : sql`${ordenacao}`
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

/** Ordem alfabética dos rótulos de `stock_count_status`: Cancelada, Concluída, Contando, Em conferência. */
export const STOCK_COUNT_STATUS_LABEL_ORDER = ['cancelada', 'concluida', 'em_andamento', 'em_conferencia'] as const
