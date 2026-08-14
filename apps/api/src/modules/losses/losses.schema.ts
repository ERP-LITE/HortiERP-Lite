import { z } from 'zod'
import { periodQueryFields } from '../../shared/schemas/period.schema.js'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const lossReasons = ['vencido', 'avariado', 'roubo_furto', 'erro_operacional', 'outro'] as const

export const listLossesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  productId: z.string().uuid().optional(),
  reason: z.enum(lossReasons).optional(),
  ...periodQueryFields,
  sortBy: z.enum(['lossDate', 'reason', 'quantity']).optional(),
})

export type ListLossesQuery = z.infer<typeof listLossesQuerySchema>

export const createLossSchema = z.object({
  productId: z.string().uuid('Produto inválido'),
  quantity: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  reason: z.enum(lossReasons),
  notes: z.string().optional(),
  lossDate: z.coerce.date().optional(),
})

export type CreateLossInput = z.infer<typeof createLossSchema>
