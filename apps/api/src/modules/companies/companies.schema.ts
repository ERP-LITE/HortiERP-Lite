import { z } from 'zod'
import { emailSchema } from '../../shared/schemas/email.schema.js'
import { ufSchema } from '../../shared/schemas/uf.schema.js'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listCompaniesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  sortBy: z.enum(['name', 'document', 'active']).optional(),
})

export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>

/**
 * CNPJ alfanumérico (IN RFB 2.229/2024): as 12 primeiras posições aceitam letra maiúscula ou
 * dígito e os dois dígitos verificadores continuam numéricos. No módulo 11, o valor de cada
 * posição é o código ASCII menos 48, o que faz '0' a '9' valerem 0 a 9: o cálculo continua
 * idêntico para os CNPJ só de dígitos que já estão no banco.
 */
function isValidCnpj(value: string) {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false
  const calculateDigit = (length: number) => {
    let weight = length - 7
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += (value.charCodeAt(index) - 48) * weight
      weight -= 1
      if (weight === 1) weight = 9
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  return calculateDigit(12) === Number(value[12]) && calculateDigit(13) === Number(value[13])
}

const requiredText = (message: string, max = 160) => z.string().trim().min(1, message).max(max)
const optionalText = (max = 160) => z.string().trim().max(max).optional().transform((value) => value || undefined)
const cnpjSchema = z
  .string()
  .transform((value) => value.replace(/[^0-9A-Za-z]/g, '').toUpperCase())
  .refine(isValidCnpj, 'CNPJ inválido')
const phoneSchema = z.string().transform((value) => value.replace(/\D/g, '')).refine((value) => value.length >= 10 && value.length <= 11, 'Telefone inválido')
const postalCodeSchema = z.string().transform((value) => value.replace(/\D/g, '')).refine((value) => value.length === 8, 'CEP inválido')

const companyFields = {
  name: requiredText('Nome fantasia é obrigatório'),
  legalName: requiredText('Razão social é obrigatória'),
  document: cnpjSchema,
  stateRegistration: optionalText(30),
  contactName: requiredText('Responsável é obrigatório'),
  contactEmail: z.string().trim().email('E-mail de contato inválido').max(160),
  phone: phoneSchema,
  postalCode: postalCodeSchema,
  street: requiredText('Logradouro é obrigatório'),
  addressNumber: requiredText('Número é obrigatório', 30),
  complement: optionalText(120),
  district: requiredText('Bairro é obrigatório'),
  city: requiredText('Cidade é obrigatória'),
  state: ufSchema,
}

export const createCompanySchema = z.object({
  ...companyFields,
  adminName: z.string().min(1, 'Nome do administrador é obrigatório'),
  adminEmail: emailSchema,
  adminPassword: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
})

export const updateCompanySchema = z.object(companyFields).partial()

export const setCompanyActiveSchema = z.object({
  active: z.boolean(),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type SetCompanyActiveInput = z.infer<typeof setCompanyActiveSchema>
