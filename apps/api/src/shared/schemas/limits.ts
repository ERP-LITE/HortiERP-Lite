/** Espelhado em `apps/web/src/lib/limits.ts`: mudou aqui, muda lá. */
export const LIMITES_TEXTO = {
  nome: 120,
  razaoSocial: 160,
  descricao: 300,
  observacoes: 500,
  observacoesEntrada: 2000,
  motivo: 500,
  abreviacao: 10,
  sku: 40,
  codigoBarras: 60,
  fornecedor: 200,
  numeroNota: 60,
  serieNota: 20,
  chaveNfe: 44,
  email: 160,
  endereco: 160,
  complemento: 120,
  numeroEndereco: 30,
  inscricaoEstadual: 30,
  busca: 160,
} as const

/** Passar da precisão da coluna (`numeric(12,3)` e `numeric(12,2)`) vira erro 500, não 422. */
export const LIMITES_NUMERO = {
  quantidade: 999_999.999,
  valorUnitario: 9_999_999.99,
  valorNota: 99_999_999.99,
  mensalidade: 9_999_999_999.99,
} as const

export const SENHA_MAX_BYTES = 72
