import { z } from 'zod'

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
