import type { FastifyInstance, FastifyRequest } from 'fastify'
import { db } from '../../db/client.js'
import { systemLogs } from '../../db/schema/index.js'

function getAuthenticatedUser(request: FastifyRequest) {
  try {
    return request.user
  } catch {
    return undefined
  }
}

export function registerSystemLogsHook(app: FastifyInstance) {
  app.addHook('onResponse', async (request, reply) => {
    if (request.routeOptions.url === '/health' || request.routeOptions.url?.includes('/logs/')) return

    const user = getAuthenticatedUser(request)
    const statusCode = reply.statusCode
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'info'

    try {
      await db.insert(systemLogs).values({
        companyId: user?.companyId,
        actorId: user?.sub,
        actorRole: user?.role,
        method: request.method,
        path: request.routeOptions.url ?? request.url.split('?')[0],
        statusCode,
        durationMs: Math.max(0, Math.round(reply.elapsedTime)),
        level,
        errorCode: request.technicalError?.code,
        errorMessage: request.technicalError?.message,
        ip: request.ip,
        userAgent: request.headers['user-agent']?.slice(0, 500),
        metadata: user?.realCompanyId ? { impersonating: true, realCompanyId: user.realCompanyId } : undefined,
      })
    } catch (error) {
      request.log.error({ error }, 'Falha ao persistir log do sistema')
    }
  })
}
