import { z } from 'zod'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listStockQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  lowStockOnly: booleanQueryParam,
})

export type ListStockQuery = z.infer<typeof listStockQuerySchema>

export const listStockMovementsQuerySchema = paginationQuerySchema.extend({
  productId: z.string().uuid().optional(),
  type: z.enum(['entrada', 'perda', 'ajuste']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type ListStockMovementsQuery = z.infer<typeof listStockMovementsQuerySchema>
