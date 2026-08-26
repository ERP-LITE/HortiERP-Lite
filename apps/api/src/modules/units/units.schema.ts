import { z } from 'zod'
import { LIMITES_TEXTO } from '../../shared/schemas/limits.js'
import { booleanQueryParam, paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listUnitsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  active: booleanQueryParam,
  sortBy: z.enum(['name', 'abbreviation', 'active']).optional(),
})

export type ListUnitsQuery = z.infer<typeof listUnitsQuerySchema>

export const createUnitSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(LIMITES_TEXTO.nome),
  abbreviation: z.string().trim().min(1, 'Abreviação é obrigatória').max(LIMITES_TEXTO.abreviacao),
  active: z.boolean().optional(),
})

export const updateUnitSchema = createUnitSchema.partial()

export type CreateUnitInput = z.infer<typeof createUnitSchema>
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>
