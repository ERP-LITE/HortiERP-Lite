import { z } from 'zod'
import { periodQueryFields } from '../../shared/schemas/period.schema.js'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'
import { LIMITES_TEXTO } from '../../shared/schemas/limits.js'

const methodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const levelSchema = z.enum(['info', 'warning', 'error'])

export const listLogsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  method: methodSchema.optional(),
  level: levelSchema.optional(),
  companyId: z.string().uuid().optional(),
  ...periodQueryFields,
  sortBy: z.enum(['createdAt', 'companyName', 'actorName', 'level', 'statusCode']).optional(),
})

export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>

export const activityActionSchema = z.enum(['criou', 'alterou', 'excluiu', 'importou', 'ajustou', 'cancelou'])
export const activityEntitySchema = z.enum(['produto', 'categoria', 'unidade', 'usuario', 'entrada', 'perda', 'estoque'])

export const listActivityQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  action: activityActionSchema.optional(),
  entity: activityEntitySchema.optional(),
  ...periodQueryFields,
  sortBy: z.enum(['createdAt', 'actorName', 'entity', 'action']).optional(),
})

export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>
