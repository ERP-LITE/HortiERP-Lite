import type { CompanyDetailsInput } from '@/services/companiesService'
import { isValidUf } from '@/lib/ufs'
import { normalizeCnpj } from '@/lib/format'
import { SENHA_MIN } from '@/lib/limits'

/** Os campos da empresa são os mesmos que o serviço já descreve; aqui só se dá um nome ao papel. */
export type CompanyFormValues = CompanyDetailsInput

export interface AdminFormValues {
  name: string
  email: string
  password: string
  passwordConfirm: string
}

export function emptyCompanyForm(): CompanyFormValues {
  return {
    name: '',
    legalName: '',
    document: '',
    stateRegistration: '',
    contactName: '',
    contactEmail: '',
    phone: '',
    postalCode: '',
    street: '',
    addressNumber: '',
    complement: '',
    district: '',
    city: '',
    state: '',
  }
}

export function emptyAdminForm(): AdminFormValues {
  return { name: '', email: '', password: '', passwordConfirm: '' }
}

/** Quais campos moram em qual aba. É o que leva a aba certa para a frente quando o envio falha. */
export const CAMPOS_DA_ABA_GERAL = [
  'name',
  'legalName',
  'document',
  'stateRegistration',
  'contactName',
  'contactEmail',
  'phone',
]

export const CAMPOS_DA_ABA_ENDERECO = [
  'postalCode',
  'street',
  'addressNumber',
  'complement',
  'district',
  'city',
  'state',
]

function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

/** Escreve no mapa recebido para a tela juntar estes campos com os que só ela tem. */
export function validateCompanyFields(values: CompanyFormValues, fieldErrors: Record<string, string>) {
  if (!values.name.trim()) fieldErrors.name = 'Informe o nome fantasia'
  if (!values.legalName.trim()) fieldErrors.legalName = 'Informe a razão social'
  if (normalizeCnpj(values.document).length !== 14) fieldErrors.document = 'Informe um CNPJ válido'
  if (!values.contactName.trim()) fieldErrors.contactName = 'Informe o responsável'
  if (!values.contactEmail.trim()) fieldErrors.contactEmail = 'Informe o e-mail de contato'
  if (apenasDigitos(values.phone).length < 10) fieldErrors.phone = 'Informe um telefone válido'
  if (apenasDigitos(values.postalCode).length !== 8) fieldErrors.postalCode = 'Informe um CEP válido'
  if (!values.street.trim()) fieldErrors.street = 'Informe o logradouro'
  if (!values.addressNumber.trim()) fieldErrors.addressNumber = 'Informe o número'
  if (!values.district.trim()) fieldErrors.district = 'Informe o bairro'
  if (!values.city.trim()) fieldErrors.city = 'Informe a cidade'
  if (!isValidUf(values.state)) fieldErrors.state = 'Selecione a UF'
}

export function validateAdminFields(admin: AdminFormValues, fieldErrors: Record<string, string>) {
  if (!admin.name.trim()) fieldErrors.adminName = 'Informe o nome do administrador'
  if (!admin.email.trim()) fieldErrors.adminEmail = 'Informe o e-mail do administrador'
  if (!admin.password.trim() || admin.password.length < SENHA_MIN) {
    fieldErrors.adminPassword = `A senha deve ter ao menos ${SENHA_MIN} caracteres`
  } else if (admin.password !== admin.passwordConfirm) {
    fieldErrors.adminPasswordConfirm = 'A confirmação não confere com a senha'
  }
}

/**
 * A **primeira** aba com erro, não a última: quem errou CNPJ e CEP precisa começar pelo CNPJ, senão
 * corrige o CEP, envia de novo e volta para trás. `null` quando nenhuma das listadas reclama.
 */
export function primeiraAbaComErro<T extends string>(
  camposComErro: string[],
  abas: Array<{ id: T; campos: readonly string[] }>,
): T | null {
  for (const aba of abas) {
    if (camposComErro.some((campo) => aba.campos.includes(campo))) return aba.id
  }

  return null
}
