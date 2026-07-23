import { z } from 'zod'

export const dateRangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>
