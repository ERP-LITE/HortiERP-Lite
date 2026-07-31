import { z } from 'zod'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

const methodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const levelSchema = z.enum(['info', 'warning', 'error'])

export const listLogsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  method: methodSchema.optional(),
  level: levelSchema.optional(),
  companyId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>
