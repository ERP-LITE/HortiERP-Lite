/** Quantidade em pt-BR sem zeros à direita: `numeric(_, 3)` devolve "50.000", que se lê como 50 mil. */
export function formatQuantity(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}
