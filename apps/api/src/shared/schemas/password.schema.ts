import { z } from 'zod'
import { SENHA_MAX_BYTES, SENHA_MIN_CARACTERES } from './limits.js'

/** Em bytes, não em caracteres: o bcrypt corta no 72º byte e um acento ocupa dois. */
export const passwordSchema = z
  .string()
  .min(SENHA_MIN_CARACTERES, `Senha deve ter ao menos ${SENHA_MIN_CARACTERES} caracteres`)
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= SENHA_MAX_BYTES,
    `Senha muito longa: use no máximo ${SENHA_MAX_BYTES} caracteres`,
  )
