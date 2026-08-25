import { z } from 'zod'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listUnitsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  active: booleanQueryParam,
  sortBy: z.enum(['name', 'abbreviation', 'active']).optional(),
})

export type ListUnitsQuery = z.infer<typeof listUnitsQuerySchema>

export const createUnitSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  abbreviation: z.string().min(1, 'Abreviação é obrigatória').max(10),
  active: z.boolean().optional(),
})

export const updateUnitSchema = createUnitSchema.partial()

export type CreateUnitInput = z.infer<typeof createUnitSchema>
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>
