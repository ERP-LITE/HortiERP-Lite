import { z } from 'zod'
import { emailSchema } from '../../shared/schemas/email.schema.js'
import { passwordSchema } from '../../shared/schemas/password.schema.js'
import { LIMITES_TEXTO } from '../../shared/schemas/limits.js'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listPlatformUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  sortBy: z.enum(['name', 'email']).optional(),
})

export const createPlatformUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(LIMITES_TEXTO.nome),
  email: emailSchema,
  password: passwordSchema,
})

export const updatePlatformUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(LIMITES_TEXTO.nome).optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
})

export type CreatePlatformUserInput = z.infer<typeof createPlatformUserSchema>
export type UpdatePlatformUserInput = z.infer<typeof updatePlatformUserSchema>
export type ListPlatformUsersQuery = z.infer<typeof listPlatformUsersQuerySchema>
