import { z } from 'zod'
import { emailSchema } from '../../shared/schemas/email.schema.js'
import { ufSchema } from '../../shared/schemas/uf.schema.js'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listCompaniesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  sortBy: z.enum(['name', 'document', 'active']).optional(),
})

export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>

function isValidCnpj(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false
  const calculateDigit = (length: number) => {
    let weight = length - 7
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * weight
      weight -= 1
      if (weight === 1) weight = 9
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  return calculateDigit(12) === Number(digits[12]) && calculateDigit(13) === Number(digits[13])
}

const requiredText = (message: string, max = 160) => z.string().trim().min(1, message).max(max)
const optionalText = (max = 160) => z.string().trim().max(max).optional().transform((value) => value || undefined)
const cnpjSchema = z.string().transform((value) => value.replace(/\D/g, '')).refine(isValidCnpj, 'CNPJ inválido')
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
