import type { ShrinkageSummary } from '@/types'

export type ShrinkageStatus = 'sem-dados' | 'dentro' | 'atencao' | 'acima'

/**
 * A faixa de atenção começa em 80% da meta porque quebra que encostou no limite ainda cabe correção;
 * avisar só depois de estourar transforma o painel em relatório de estrago.
 */
const INICIO_DA_ATENCAO = 0.8

export function shrinkageStatus(summary: ShrinkageSummary): ShrinkageStatus {
  if (summary.percent === null) return 'sem-dados'
  if (summary.percent > summary.targetPercent) return 'acima'
  if (summary.percent >= summary.targetPercent * INICIO_DA_ATENCAO) return 'atencao'
  return 'dentro'
}

export const shrinkageStatusLabels: Record<ShrinkageStatus, string> = {
  'sem-dados': 'Sem entrada no período',
  dentro: 'Dentro da meta',
  atencao: 'Perto da meta',
  acima: 'Acima da meta',
}

export const shrinkageStatusVariants: Record<ShrinkageStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  'sem-dados': 'neutral',
  dentro: 'success',
  atencao: 'warning',
  acima: 'danger',
}

/** Quanto da barra a quebra ocupa, tomando a meta como dois terços da largura. */
export function shrinkageBarWidth(summary: ShrinkageSummary) {
  if (summary.percent === null || summary.targetPercent <= 0) return 0
  const proporcao = (summary.percent / summary.targetPercent) * (2 / 3)
  return Math.min(100, Math.round(proporcao * 1000) / 10)
}
