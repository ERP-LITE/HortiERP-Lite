import { z } from 'zod'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listCategoriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  active: booleanQueryParam,
  sortBy: z.enum(['name', 'description', 'active']).optional(),
})

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  active: z.boolean().optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
