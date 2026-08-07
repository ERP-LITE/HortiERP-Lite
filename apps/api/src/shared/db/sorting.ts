import { asc, desc, sql, type SQL, type SQLWrapper } from 'drizzle-orm'

export type SortOrder = 'asc' | 'desc'

/**
 * Monta a expressão de ordenação de uma listagem.
 *
 * Centraliza aqui duas decisões que antes ficavam repetidas (e divergentes)
 * em cada módulo: a direção assumida quando o cliente não manda `sortOrder`,
 * e o `nulls last`. No Postgres, `desc` traz os nulos primeiro por padrão —
 * sem isso, ordenar produtos por custo decrescente empurraria justamente os
 * produtos sem custo cadastrado para o topo da tela.
 */
export function orderByColumn(
  column: SQLWrapper,
  sortOrder: SortOrder | undefined,
  defaultOrder: SortOrder = 'asc',
): SQL {
  return (sortOrder ?? defaultOrder) === 'asc' ? sql`${asc(column)} nulls last` : sql`${desc(column)} nulls last`
}

/**
 * Ordena uma coluna enum pela ordem alfabética dos rótulos exibidos na tela,
 * e não pela ordem em que os valores foram declarados no banco.
 *
 * Sem isso, ordenar Perdas por "Motivo" seguiria `vencido → avariado → ...`,
 * uma sequência que não corresponde a nada visível para quem usa o sistema.
 * A coluna é convertida para texto na comparação porque o driver envia os
 * valores como parâmetros sem tipo, o que o Postgres não casa direto com enum.
 */
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
