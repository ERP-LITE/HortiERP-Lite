import { z } from 'zod'
import { periodQueryFields } from '../../shared/schemas/period.schema.js'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'
import { LIMITES_TEXTO } from '../../shared/schemas/limits.js'

export const dateRangeQuerySchema = paginationQuerySchema.extend({
  ...periodQueryFields,
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
})

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>
