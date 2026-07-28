import { z } from 'zod'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'gerente', 'operador']).optional(),
  active: booleanQueryParam,
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(['admin', 'gerente', 'operador']).default('operador'),
  active: z.boolean().default(true),
})

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').optional(),
  role: z.enum(['admin', 'gerente', 'operador']).optional(),
  active: z.boolean().optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
