import { z } from 'zod'
import { periodQueryFields } from '../../shared/schemas/period.schema.js'

export const dashboardQuerySchema = z.object({
  ...periodQueryFields,
})

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
