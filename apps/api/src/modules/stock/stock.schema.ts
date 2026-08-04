import { z } from 'zod'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listStockQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  lowStockOnly: booleanQueryParam,
})

export type ListStockQuery = z.infer<typeof listStockQuerySchema>

export const listStockMovementsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  productId: z.string().uuid().optional(),
  type: z.enum(['entrada', 'perda', 'ajuste']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type ListStockMovementsQuery = z.infer<typeof listStockMovementsQuerySchema>

export const createStockAdjustmentSchema = z.object({
  productId: z.string().uuid('Produto inválido'),
  quantity: z.coerce.number().min(0, 'Quantidade não pode ser negativa'),
  notes: z.string().trim().min(1, 'Informe o motivo do ajuste'),
})

export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>
