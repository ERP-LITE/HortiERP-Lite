import { databaseErrorCode, databaseErrorProperty, UNIQUE_VIOLATION } from './pgErrors.js'

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
  companies_name_active_unique: {
    field: 'name',
    message: 'Já existe uma empresa com esse nome fantasia',
  },
  companies_legal_name_active_unique: {
    field: 'legalName',
    message: 'Já existe uma empresa com essa razão social',
  },
  companies_state_registration_active_unique: {
    field: 'stateRegistration',
    message: 'Já existe uma empresa com essa inscrição estadual',
  },
  companies_contact_email_active_unique: {
    field: 'contactEmail',
    message: 'Já existe uma empresa com esse e-mail de contato',
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

/**
 * Nome do índice violado quando o erro é de unicidade; `undefined` nos outros casos, e
 * string vazia quando é 23505 sem o driver informar o índice.
 */
export function uniqueViolationConstraint(error: unknown): string | undefined {
  if (databaseErrorCode(error) !== UNIQUE_VIOLATION) return undefined

  return databaseErrorProperty(error, 'constraint') ?? ''
}
