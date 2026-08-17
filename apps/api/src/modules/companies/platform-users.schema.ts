import { z } from 'zod'
import { emailSchema } from '../../shared/schemas/email.schema.js'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listPlatformUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  sortBy: z.enum(['name', 'email']).optional(),
})

export const createPlatformUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  email: emailSchema,
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
})

export const updatePlatformUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').optional(),
  email: emailSchema.optional(),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').optional(),
})

export type CreatePlatformUserInput = z.infer<typeof createPlatformUserSchema>
export type UpdatePlatformUserInput = z.infer<typeof updatePlatformUserSchema>
export type ListPlatformUsersQuery = z.infer<typeof listPlatformUsersQuerySchema>
