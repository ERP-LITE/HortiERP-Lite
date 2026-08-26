import { z } from 'zod'

const numero = (valor: number | bigint) => Number(valor).toLocaleString('pt-BR')

const tipos: Record<string, string> = {
  string: 'texto',
  number: 'número',
  boolean: 'sim ou não',
  date: 'data',
  array: 'lista',
  object: 'objeto',
}

function mensagemTamanhoMinimo(issue: z.ZodTooSmallIssue) {
  const minimo = numero(issue.minimum)
  if (issue.type === 'string') {
    if (issue.minimum === 1) return 'Campo obrigatório'
    return `Informe ao menos ${minimo} caracteres`
  }
  if (issue.type === 'array') return `Informe ao menos ${minimo} ${issue.minimum === 1 ? 'item' : 'itens'}`
  if (issue.type === 'date') return 'Data muito antiga'
  return issue.inclusive ? `O valor deve ser maior ou igual a ${minimo}` : `O valor deve ser maior que ${minimo}`
}

function mensagemTamanhoMaximo(issue: z.ZodTooBigIssue) {
  const maximo = numero(issue.maximum)
  if (issue.type === 'string') return `Use no máximo ${maximo} caracteres`
  if (issue.type === 'array') return `Informe no máximo ${maximo} ${issue.maximum === 1 ? 'item' : 'itens'}`
  if (issue.type === 'date') return 'Data muito distante'
  return issue.inclusive ? `O valor deve ser menor ou igual a ${maximo}` : `O valor deve ser menor que ${maximo}`
}

function mensagemTextoInvalido(issue: z.ZodInvalidStringIssue) {
  if (issue.validation === 'email') return 'E-mail inválido'
  if (issue.validation === 'uuid') return 'Registro inválido'
  if (issue.validation === 'url') return 'Endereço inválido'
  if (issue.validation === 'datetime' || issue.validation === 'date') return 'Data inválida'
  return 'Formato inválido'
}

const traduzir: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'Campo obrigatório' }
      return { message: `Informe um valor do tipo ${tipos[issue.expected] ?? issue.expected}` }
    case z.ZodIssueCode.invalid_enum_value:
    case z.ZodIssueCode.invalid_literal:
    case z.ZodIssueCode.invalid_union_discriminator:
      return { message: 'Selecione uma das opções disponíveis' }
    case z.ZodIssueCode.invalid_union:
      return { message: 'Valor inválido' }
    case z.ZodIssueCode.invalid_date:
      return { message: 'Data inválida' }
    case z.ZodIssueCode.invalid_string:
      return { message: mensagemTextoInvalido(issue) }
    case z.ZodIssueCode.too_small:
      return { message: mensagemTamanhoMinimo(issue) }
    case z.ZodIssueCode.too_big:
      return { message: mensagemTamanhoMaximo(issue) }
    case z.ZodIssueCode.not_multiple_of:
      return { message: `O valor deve ser múltiplo de ${numero(issue.multipleOf)}` }
    case z.ZodIssueCode.not_finite:
      return { message: 'Informe um número válido' }
    case z.ZodIssueCode.unrecognized_keys:
      return { message: 'Foram enviados campos que não pertencem a este cadastro' }
    default:
      return { message: ctx.defaultError === 'Required' ? 'Campo obrigatório' : ctx.defaultError }
  }
}

z.setErrorMap(traduzir)

export { traduzir as zodErrorMapPtBr }
