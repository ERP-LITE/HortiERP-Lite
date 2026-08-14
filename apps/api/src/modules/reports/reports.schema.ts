import { z } from 'zod'
import { periodQueryFields } from '../../shared/schemas/period.schema.js'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const dateRangeQuerySchema = paginationQuerySchema.extend({
  ...periodQueryFields,
  search: z.string().trim().min(1).optional(),
})

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>
