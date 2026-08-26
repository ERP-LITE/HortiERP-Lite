import { z } from 'zod'
import { SENHA_MAX_BYTES } from './limits.js'

/** Em bytes, não em caracteres: o bcrypt corta no 72º byte e um acento ocupa dois. */
export const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter ao menos 8 caracteres')
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= SENHA_MAX_BYTES,
    `Senha muito longa: use no máximo ${SENHA_MAX_BYTES} caracteres`,
  )
