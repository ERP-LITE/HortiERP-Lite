export const UNIQUE_CONSTRAINTS = {
  categories_company_name_active_unique: {
    field: 'name',
    message: 'Já existe uma categoria com esse nome',
  },
  units_company_name_active_unique: {
    field: 'name',
    message: 'Já existe uma unidade com esse nome',
  },
  units_company_abbreviation_active_unique: {
    field: 'abbreviation',
    message: 'Já existe uma unidade com essa abreviação',
  },
  products_company_name_active_unique: {
    field: 'name',
    message: 'Já existe um produto com esse nome',
  },
  products_company_sku_active_unique: {
    field: 'sku',
    message: 'Já existe um produto com esse SKU',
  },
  companies_document_active_unique: {
    field: 'document',
    message: 'Já existe uma empresa com esse CNPJ',
  },
  users_email_active_unique: {
    field: 'email',
    message: 'Já existe um usuário com esse e-mail',
  },
  company_billings_company_reference_unique: {
    field: 'referenceMonth',
    message: 'Já existe uma cobrança para essa empresa e competência',
  },
} as const satisfies Record<string, { field: string; message: string }>

export type UniqueConstraintName = keyof typeof UNIQUE_CONSTRAINTS

const UNIQUE_VIOLATION = '23505'

function textProperty(value: unknown, property: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const found = (value as Record<string, unknown>)[property]
  return typeof found === 'string' ? found : undefined
}

/**
 * Nome do índice violado quando o erro é de unicidade; `undefined` nos outros casos, e
 * string vazia quando é 23505 sem o driver informar o índice. Confere também o `cause`,
 * onde o Drizzle embrulha o erro do driver dentro de uma transação.
 */
export function uniqueViolationConstraint(error: unknown): string | undefined {
  const cause = typeof error === 'object' && error !== null ? (error as { cause?: unknown }).cause : undefined

  const databaseError =
    textProperty(error, 'code') === UNIQUE_VIOLATION
      ? error
      : textProperty(cause, 'code') === UNIQUE_VIOLATION
        ? cause
        : undefined

  if (databaseError === undefined) return undefined

  return textProperty(databaseError, 'constraint') ?? ''
}
