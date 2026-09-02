import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/middlewares/auth.js'
import { getOperationalAlerts } from './notifications.service.js'

export async function notificationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/notifications', async (request) => getOperationalAlerts(request.user.companyId))
}
