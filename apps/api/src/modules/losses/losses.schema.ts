import { z } from 'zod'
import { eventDateSchema } from '../../shared/schemas/eventDate.schema.js'
import { LIMITES_NUMERO, LIMITES_TEXTO } from '../../shared/schemas/limits.js'
import { periodQueryFields } from '../../shared/schemas/period.schema.js'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const lossReasons = ['vencido', 'avariado', 'roubo_furto', 'erro_operacional', 'outro'] as const

export const listLossesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  productId: z.string().uuid().optional(),
  reason: z.enum(lossReasons).optional(),
  ...periodQueryFields,
  includeCancelled: booleanQueryParam,
  sortBy: z.enum(['lossDate', 'reason', 'quantity']).optional(),
})

export type ListLossesQuery = z.infer<typeof listLossesQuerySchema>

export const createLossSchema = z.object({
  productId: z.string().uuid('Produto inválido'),
  quantity: z.coerce
    .number()
    .positive('Quantidade deve ser maior que zero')
    .max(LIMITES_NUMERO.quantidade),
  reason: z.enum(lossReasons),
  notes: z.string().trim().max(LIMITES_TEXTO.observacoes).optional(),
  lossDate: eventDateSchema.optional(),
})

export type CreateLossInput = z.infer<typeof createLossSchema>

export const updateLossSchema = z
  .object({
    reason: z.enum(lossReasons).optional(),
    notes: z.string().trim().max(LIMITES_TEXTO.observacoes).nullable().optional(),
  })
  .refine((data) => data.reason !== undefined || data.notes !== undefined, {
    message: 'Informe ao menos um campo para alterar',
  })

export type UpdateLossInput = z.infer<typeof updateLossSchema>

export const cancelLossSchema = z.object({
  cancelReason: z.string().trim().min(1, 'Informe o motivo do cancelamento').max(LIMITES_TEXTO.motivo),
})

export type CancelLossInput = z.infer<typeof cancelLossSchema>
