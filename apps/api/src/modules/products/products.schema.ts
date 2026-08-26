import { z } from 'zod'
import { LIMITES_NUMERO, LIMITES_TEXTO } from '../../shared/schemas/limits.js'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listProductsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  categoryId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  active: booleanQueryParam,
  sortBy: z.enum(['name', 'sku', 'costPrice', 'currentStock', 'active']).optional(),
})

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>

const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional()

const clearableMoney = z.preprocess(
  (value) => (value === '' ? null : value),
  z.coerce.number().nonnegative().max(LIMITES_NUMERO.valorUnitario).nullable().optional(),
)

export const createProductSchema = z.object({
  categoryId: z.string().uuid('Categoria inválida'),
  unitId: z.string().uuid('Unidade de medida inválida'),
  name: z.string().trim().min(1, 'Nome é obrigatório').max(LIMITES_TEXTO.nome),
  sku: clearableText(LIMITES_TEXTO.sku),
  barcode: clearableText(LIMITES_TEXTO.codigoBarras),
  costPrice: clearableMoney,
  salePrice: clearableMoney,
  minStock: z.coerce.number().nonnegative().max(LIMITES_NUMERO.quantidade).default(0),
  active: z.boolean().default(true),
})

export const updateProductSchema = createProductSchema.partial()

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>

export const IMPORT_MAX_ROWS = 2000

export const importProductsSchema = z.object({
  dryRun: z.boolean().default(false),
  skipInvalid: z.boolean().default(false),
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
