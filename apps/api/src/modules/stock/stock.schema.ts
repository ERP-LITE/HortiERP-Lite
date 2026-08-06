import { z } from 'zod'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listStockQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  lowStockOnly: booleanQueryParam,
  sortBy: z.enum(['name', 'currentStock', 'minStock']).optional(),
})

export type ListStockQuery = z.infer<typeof listStockQuerySchema>

export const listStockMovementsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  productId: z.string().uuid().optional(),
  type: z.enum(['entrada', 'perda', 'ajuste']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'type', 'quantity', 'balanceAfter']).optional(),
})

export type ListStockMovementsQuery = z.infer<typeof listStockMovementsQuerySchema>

export const stockAdjustmentItemSchema = z.object({
  productId: z.string().uuid('Produto inválido'),
  quantity: z.coerce.number().min(0, 'Quantidade não pode ser negativa'),
})

export const createStockAdjustmentSchema = z.object({
  notes: z.string().trim().min(1, 'Informe o motivo do ajuste'),
  items: z.array(stockAdjustmentItemSchema).min(1, 'Informe ao menos um produto'),
})

export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>
