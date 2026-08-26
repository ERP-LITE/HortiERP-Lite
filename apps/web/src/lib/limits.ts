/** Espelho de `apps/api/src/shared/schemas/limits.ts`: mudou lá, muda aqui. Quem valida é o backend. */
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
  senha: 72,
  busca: 160,
} as const

export const LIMITES_NUMERO = {
  quantidade: 999_999.999,
  valorUnitario: 9_999_999.99,
  valorNota: 99_999_999.99,
  mensalidade: 9_999_999_999.99,
} as const
