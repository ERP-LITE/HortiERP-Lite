import { z } from 'zod'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listPlatformUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
})

export const createPlatformUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
})

export const updatePlatformUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').optional(),
  email: z.string().trim().email('E-mail inválido').optional(),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').optional(),
})

export type CreatePlatformUserInput = z.infer<typeof createPlatformUserSchema>
export type UpdatePlatformUserInput = z.infer<typeof updatePlatformUserSchema>
export type ListPlatformUsersQuery = z.infer<typeof listPlatformUsersQuerySchema>
