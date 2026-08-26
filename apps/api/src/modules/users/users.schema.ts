import { z } from 'zod'
import { emailSchema } from '../../shared/schemas/email.schema.js'
import { passwordSchema } from '../../shared/schemas/password.schema.js'
import { LIMITES_TEXTO } from '../../shared/schemas/limits.js'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  role: z.enum(['admin', 'gerente', 'operador']).optional(),
  active: booleanQueryParam,
  sortBy: z.enum(['name', 'email', 'role', 'active']).optional(),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(LIMITES_TEXTO.nome),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['admin', 'gerente', 'operador']).default('operador'),
  active: z.boolean().default(true),
})

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(LIMITES_TEXTO.nome).optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  role: z.enum(['admin', 'gerente', 'operador']).optional(),
  active: z.boolean().optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
