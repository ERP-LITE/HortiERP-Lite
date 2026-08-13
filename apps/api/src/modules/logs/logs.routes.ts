import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import { listActivityQuerySchema, listLogsQuerySchema } from './logs.schema.js'
import { listCompanyActivityLogs, listTechnicalLogs } from './logs.service.js'

export async function logsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/logs/technical', { preHandler: requireRole('super_admin') }, async (request) => {
    const query = listLogsQuerySchema.parse(request.query)
    return listTechnicalLogs(query)
  })

  app.get('/logs/activity', { preHandler: requireRole('admin') }, async (request) => {
    const query = listActivityQuerySchema.parse(request.query)
    return listCompanyActivityLogs(request.user.companyId, query)
  })
}
