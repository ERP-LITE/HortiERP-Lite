import { z } from 'zod'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listStockEntriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type ListStockEntriesQuery = z.infer<typeof listStockEntriesQuerySchema>

export const stockEntryItemSchema = z.object({
  productId: z.string().uuid('Produto inválido'),
  quantity: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  unitCost: z.coerce.number().nonnegative().optional(),
})

export const createStockEntrySchema = z.object({
  supplierName: z.string().optional(),
  entryDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  items: z.array(stockEntryItemSchema).min(1, 'Informe ao menos um item'),
})

export type CreateStockEntryInput = z.infer<typeof createStockEntrySchema>
