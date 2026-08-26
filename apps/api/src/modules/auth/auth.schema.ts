import { z } from 'zod'
import { emailSchema } from '../../shared/schemas/email.schema.js'
import { passwordSchema } from '../../shared/schemas/password.schema.js'
import { SENHA_MAX_BYTES } from '../../shared/schemas/limits.js'

export const loginSchema = z.object({
  email: emailSchema,
  // Sem `passwordSchema` de propósito: senha antiga e curta não pode virar "dados inválidos" no login.
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres').max(SENHA_MAX_BYTES * 4),
})

export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual').max(SENHA_MAX_BYTES * 4),
  newPassword: passwordSchema,
})

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
