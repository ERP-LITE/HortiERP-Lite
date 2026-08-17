import { z } from 'zod'
import { emailSchema } from '../../shared/schemas/email.schema.js'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'gerente', 'operador']).optional(),
  active: booleanQueryParam,
  sortBy: z.enum(['name', 'email', 'role', 'active']).optional(),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: emailSchema,
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(['admin', 'gerente', 'operador']).default('operador'),
  active: z.boolean().default(true),
})

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: emailSchema.optional(),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').optional(),
  role: z.enum(['admin', 'gerente', 'operador']).optional(),
  active: z.boolean().optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
