import { formatChartNumber } from '@/lib/format'
import type { DashboardProductQuantity, DashboardQuantityByUnit } from '@/types'

/** Distância mínima da borda da janela, para o balão não nascer cortado. */
const MARGEM_DA_JANELA = 140

/**
 * Onde o balão aparece. Com o ponteiro ele segue o cursor; pelo teclado não existe cursor, então
 * ancora no gráfico, e cada gráfico informa a que altura dele o balão fica melhor.
 */
export function tooltipPosition(event: MouseEvent | FocusEvent, bounds: DOMRect, focusOffsetY: number) {
  const fromPointer = event instanceof MouseEvent
  return {
    x: fromPointer
      ? Math.min(Math.max(event.clientX, MARGEM_DA_JANELA), window.innerWidth - MARGEM_DA_JANELA)
      : bounds.left + bounds.width / 2,
    y: fromPointer ? event.clientY : bounds.top + focusOffsetY,
  }
}

/**
 * As linhas de detalhe do balão: um total por unidade, os maiores produtos e quantos ficaram de fora.
 * `emptyText` existe porque o gráfico de movimentações prefere dizer que não houve quantidade a
 * mostrar só a lista de produtos.
 */
export function buildDetails(
  totals: DashboardQuantityByUnit[],
  products: DashboardProductQuantity[],
  otherProductsCount: number,
  emptyText?: string,
) {
  const totalLines = totals.map((item) => `Total: ${formatChartNumber(item.quantity)} ${item.unitAbbreviation}`)
  const productLines = products.map(
    (item) => `${item.productName}: ${formatChartNumber(item.quantity)} ${item.unitAbbreviation}`,
  )
  if (otherProductsCount > 0) productLines.push(`+ ${otherProductsCount} outros produtos`)
  if (totalLines.length === 0 && emptyText) return [emptyText]

  return [...totalLines, ...productLines]
}
