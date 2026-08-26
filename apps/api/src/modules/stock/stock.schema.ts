import { z } from 'zod'
import { periodQueryFields } from '../../shared/schemas/period.schema.js'
import { LIMITES_NUMERO, LIMITES_TEXTO } from '../../shared/schemas/limits.js'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listStockQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  categoryId: z.string().uuid().optional(),
  lowStockOnly: booleanQueryParam,
  sortBy: z.enum(['name', 'currentStock', 'minStock']).optional(),
})

export type ListStockQuery = z.infer<typeof listStockQuerySchema>

export const listStockMovementsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  productId: z.string().uuid().optional(),
  type: z.enum(['entrada', 'perda', 'ajuste']).optional(),
  ...periodQueryFields,
  sortBy: z.enum(['movementDate', 'type', 'quantity', 'balanceAfter']).optional(),
})

export type ListStockMovementsQuery = z.infer<typeof listStockMovementsQuerySchema>

export const MAX_ITENS_POR_AJUSTE = 100

export const stockAdjustmentItemSchema = z.object({
  productId: z.string().uuid('Produto inválido'),
  quantity: z.coerce.number().min(0, 'Quantidade não pode ser negativa').max(LIMITES_NUMERO.quantidade),
})

export const createStockAdjustmentSchema = z.object({
  notes: z.string().trim().min(1, 'Informe o motivo do ajuste').max(LIMITES_TEXTO.motivo),
  items: z.array(stockAdjustmentItemSchema).min(1, 'Informe ao menos um produto').max(MAX_ITENS_POR_AJUSTE),
})

export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>
