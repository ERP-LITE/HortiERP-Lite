import { z } from 'zod'

export const createProductSchema = z.object({
  categoryId: z.string().uuid('Categoria inválida'),
  unitId: z.string().uuid('Unidade de medida inválida'),
  name: z.string().min(1, 'Nome é obrigatório'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  costPrice: z.coerce.number().nonnegative().optional(),
  salePrice: z.coerce.number().nonnegative().optional(),
  minStock: z.coerce.number().nonnegative().default(0),
  active: z.boolean().default(true),
})

export const updateProductSchema = createProductSchema.partial()

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
