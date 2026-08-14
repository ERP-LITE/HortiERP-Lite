import { z } from 'zod'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listProductsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  active: booleanQueryParam,
  sortBy: z.enum(['name', 'sku', 'costPrice', 'currentStock', 'active']).optional(),
})

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>

/**
 * Campo de texto opcional do produto. Aceita `null` e converte branco em `null`
 * para que apagar o campo na tela realmente limpe o valor. Guardar `''` faria dois
 * produtos sem SKU colidirem no índice único parcial (que só ignora `null`),
 * devolvendo um 409 dizendo que o SKU já existe.
 *
 * Ausência da chave continua significando "não mexe neste campo" — só `''` e `null`
 * limpam.
 */
const clearableText = z
  .string()
  .trim()
  .transform((value) => value || null)
  .nullable()
  .optional()

/** Valor monetário opcional; branco e `null` limpam o campo. */
const clearableMoney = z.preprocess(
  (value) => (value === '' ? null : value),
  z.coerce.number().nonnegative().nullable().optional(),
)

export const createProductSchema = z.object({
  categoryId: z.string().uuid('Categoria inválida'),
  unitId: z.string().uuid('Unidade de medida inválida'),
  name: z.string().min(1, 'Nome é obrigatório'),
  sku: clearableText,
  barcode: clearableText,
  costPrice: clearableMoney,
  salePrice: clearableMoney,
  minStock: z.coerce.number().nonnegative().default(0),
  active: z.boolean().default(true),
})

export const updateProductSchema = createProductSchema.partial()

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>

export const IMPORT_MAX_ROWS = 2000

export const importProductsSchema = z.object({
  dryRun: z.boolean().default(false),
  createMissingRefs: z.boolean().default(false),
  rows: z
    .array(
      z.object({
        line: z.coerce.number().int().positive(),
        name: z.string().default(''),
        categoryName: z.string().default(''),
        unitName: z.string().default(''),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        costPrice: z.string().optional(),
        salePrice: z.string().optional(),
        minStock: z.string().optional(),
        currentStock: z.string().optional(),
        active: z.string().optional(),
      }),
    )
    .min(1, 'A planilha não tem nenhuma linha de produto')
    .max(IMPORT_MAX_ROWS, `Importe no máximo ${IMPORT_MAX_ROWS} produtos por vez`),
})

export type ImportProductsInput = z.infer<typeof importProductsSchema>
export type ImportProductRow = ImportProductsInput['rows'][number]
