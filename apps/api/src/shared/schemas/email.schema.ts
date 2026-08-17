import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email('E-mail inválido').max(160)
