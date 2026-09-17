/**
 * Margem aqui é sempre sobre o **preço de venda**, não sobre o custo. É a convenção do varejo
 * brasileiro, e trocar por markup muda o preço sugerido: custo de R$ 10 com 40% de margem vende a
 * R$ 16,67, com 40% de markup venderia a R$ 14,00. Ver docs/decisoes-arquiteturais.md.
 */
function numero(valor: string | number | null | undefined) {
  if (valor === null || valor === undefined || valor === '') return null
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : null
}

function duasCasas(valor: number) {
  return Math.round(valor * 100) / 100
}

/** Margem que o preço praticado hoje entrega. Sem preço de venda não existe margem a calcular. */
export function currentMargin(costPrice: string | number | null, salePrice: string | number | null) {
  const custo = numero(costPrice)
  const venda = numero(salePrice)
  if (venda === null || venda <= 0 || custo === null) return null
  return duasCasas(((venda - custo) / venda) * 100)
}

/** A do produto manda; sem ela, vale a da categoria. */
export function effectiveTargetMargin(
  productMargin: string | number | null,
  categoryMargin: string | number | null,
) {
  return numero(productMargin) ?? numero(categoryMargin)
}

/** Preço que entregaria a margem alvo a partir do custo cadastrado. */
export function suggestedPrice(costPrice: string | number | null, targetMargin: number | null) {
  const custo = numero(costPrice)
  if (custo === null || custo <= 0 || targetMargin === null) return null
  if (targetMargin < 0 || targetMargin >= 100) return null
  return duasCasas(custo / (1 - targetMargin / 100))
}

export function pricing(row: {
  costPrice: string | null
  salePrice: string | null
  targetMargin: string | null
  categoryTargetMargin: string | null
}) {
  const alvo = effectiveTargetMargin(row.targetMargin, row.categoryTargetMargin)
  return {
    currentMargin: currentMargin(row.costPrice, row.salePrice),
    effectiveTargetMargin: alvo,
    targetMarginInherited: numero(row.targetMargin) === null && alvo !== null,
    suggestedPrice: suggestedPrice(row.costPrice, alvo),
  }
}
