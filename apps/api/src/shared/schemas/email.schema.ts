import { z } from 'zod'
import { LIMITES_TEXTO } from './limits.js'

export const emailSchema = z.string().trim().toLowerCase().email('E-mail inválido').max(LIMITES_TEXTO.email)
