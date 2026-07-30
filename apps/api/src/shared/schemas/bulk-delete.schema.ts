import { z } from 'zod'

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>
