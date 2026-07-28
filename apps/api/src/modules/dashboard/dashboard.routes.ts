import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/middlewares/auth.js'
import { dashboardQuerySchema } from './dashboard.schema.js'
import { getDashboardSummary } from './dashboard.service.js'

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/dashboard/summary', async (request) => {
    const query = dashboardQuerySchema.parse(request.query)
    return getDashboardSummary(request.user.companyId, query)
  })
}
