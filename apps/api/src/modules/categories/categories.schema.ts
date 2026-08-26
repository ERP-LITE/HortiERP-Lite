import { z } from 'zod'
import { LIMITES_TEXTO } from '../../shared/schemas/limits.js'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listCategoriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  active: booleanQueryParam,
  sortBy: z.enum(['name', 'description', 'active']).optional(),
})

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(LIMITES_TEXTO.nome),
  description: z.string().trim().max(LIMITES_TEXTO.descricao).optional(),
  active: z.boolean().optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
