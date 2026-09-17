export type MarginTone = 'sem-dados' | 'prejuizo' | 'abaixo' | 'ok'

/**
 * Compara a margem praticada com o alvo. Prejuízo vem antes do alvo de propósito: vender abaixo do
 * custo é problema mesmo em produto que nunca teve margem alvo definida.
 */
export function marginTone(currentMargin: number | null, targetMargin: number | null): MarginTone {
  if (currentMargin === null) return 'sem-dados'
  if (currentMargin < 0) return 'prejuizo'
  if (targetMargin !== null && currentMargin < targetMargin) return 'abaixo'
  return 'ok'
}

export const marginToneClasses: Record<MarginTone, string> = {
  'sem-dados': 'text-gray-400 dark:text-gray-500',
  prejuizo: 'text-red-600 dark:text-red-400',
  abaixo: 'text-amber-600 dark:text-amber-400',
  ok: 'text-gray-700 dark:text-gray-300',
}

/**
 * O preço sugerido só vira aviso quando difere do praticado. Um centavo de diferença é ruído de
 * arredondamento, não recomendação de remarcar a gôndola.
 */
export function shouldSuggestPrice(salePrice: string | null, suggestedPrice: number | null) {
  if (suggestedPrice === null) return false
  if (salePrice === null || salePrice === '') return true
  return Math.abs(Number(salePrice) - suggestedPrice) > 0.01
}
