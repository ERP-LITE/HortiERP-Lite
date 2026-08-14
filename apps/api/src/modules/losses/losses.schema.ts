import { z } from 'zod'
import { periodQueryFields } from '../../shared/schemas/period.schema.js'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const lossReasons = ['vencido', 'avariado', 'roubo_furto', 'erro_operacional', 'outro'] as const

export const listLossesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  productId: z.string().uuid().optional(),
  reason: z.enum(lossReasons).optional(),
  ...periodQueryFields,
  // Canceladas ficam fora por padrão: a tela de perdas é operacional e o valor
  // estornado não conta mais como desperdício. Quem precisa conferir o que foi
  // cancelado liga o filtro; relatórios e dashboard nunca as incluem.
  includeCancelled: booleanQueryParam,
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

/**
 * Correção de uma perda já lançada. Só campos descritivos: produto, quantidade e
 * data ficam imutáveis para não alterar o estoque nem mover o registro de período
 * retroativamente — o mesmo contrato das entradas de mercadoria. Erro de produto ou
 * de quantidade se resolve cancelando a perda e lançando de novo.
 */
export const updateLossSchema = z
  .object({
    reason: z.enum(lossReasons).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((data) => data.reason !== undefined || data.notes !== undefined, {
    message: 'Informe ao menos um campo para alterar',
  })

export type UpdateLossInput = z.infer<typeof updateLossSchema>

export const cancelLossSchema = z.object({
  cancelReason: z.string().trim().min(1, 'Informe o motivo do cancelamento').max(500),
})

export type CancelLossInput = z.infer<typeof cancelLossSchema>
