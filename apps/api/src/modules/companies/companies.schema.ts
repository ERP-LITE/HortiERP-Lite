import { z } from 'zod'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listCompaniesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  sortBy: z.enum(['name', 'document', 'active']).optional(),
})

export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Nome da empresa é obrigatório'),
  document: z.string().trim().min(1).optional(),
  adminName: z.string().min(1, 'Nome do administrador é obrigatório'),
  adminEmail: z.string().email('E-mail inválido'),
  adminPassword: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
})

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  document: z.string().trim().min(1).optional(),
})

export const setCompanyActiveSchema = z.object({
  active: z.boolean(),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type SetCompanyActiveInput = z.infer<typeof setCompanyActiveSchema>
