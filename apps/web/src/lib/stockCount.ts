import { formatQuantity } from './format'
import type { StockCount, StockCountStatus } from '@/types'

export const stockCountStatusLabels: Record<StockCountStatus, string> = {
  em_andamento: 'Contando',
  em_conferencia: 'Em conferência',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const stockCountStatusVariants: Record<StockCountStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  em_andamento: 'warning',
  em_conferencia: 'warning',
  concluida: 'success',
  cancelada: 'neutral',
}

/** Como cada linha da contagem mostra que o lançamento chegou ao servidor. */
export type EstadoDoLancamento = 'parado' | 'salvando' | 'salvo' | 'erro'

export function escopoDaContagem(categoryName: string | null) {
  return categoryName ?? 'Loja toda'
}

export function progressoDaContagem(contados: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.round((contados / total) * 1000) / 10)
}

export function textoDoProgresso(contados: number, total: number) {
  return `${contados} de ${total} ${total === 1 ? 'produto contado' : 'produtos contados'}`
}

/**
 * Falta é vermelho porque é mercadoria que sumiu sem ninguém registrar, que é o que a contagem
 * existe para achar. Sobra é âmbar, não verde: achar mais do que o sistema tinha também é sinal de
 * lançamento errado, não de lucro.
 */
export type DiferencaTom = 'sobra' | 'falta' | 'bate' | 'sem-dados'

export function tomDaDiferenca(difference: number | null): DiferencaTom {
  if (difference === null) return 'sem-dados'
  if (difference > 0) return 'sobra'
  if (difference < 0) return 'falta'
  return 'bate'
}

export const diferencaClasses: Record<DiferencaTom, string> = {
  sobra: 'text-amber-600 dark:text-amber-400',
  falta: 'text-red-600 dark:text-red-400',
  bate: 'text-gray-500 dark:text-gray-400',
  'sem-dados': 'text-gray-400 dark:text-gray-500',
}

/** O sinal entra à mão: `formatQuantity` não separa sobra de falta, e o zero não leva sinal. */
export function diferencaComSinal(difference: number | null) {
  if (difference === null) return ''
  if (difference === 0) return formatQuantity(0)
  return `${difference > 0 ? '+' : '-'}${formatQuantity(Math.abs(difference))}`
}

export function podeConferir(contagem: Pick<StockCount, 'status' | 'resumo'>) {
  return contagem.status === 'em_andamento' && contagem.resumo.countedCount > 0
}
