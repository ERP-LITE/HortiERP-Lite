import { z } from 'zod'
import { emailSchema } from '../../shared/schemas/email.schema.js'

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres'),
})

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
