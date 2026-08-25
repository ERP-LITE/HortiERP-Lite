import type { FastifyInstance } from 'fastify'
import { db } from '../../db/client.js'
import { comEscopoDePlataforma } from '../../db/scope.js'
import { systemLogs } from '../../db/schema/index.js'
import { isHealthPath } from '../../shared/config/health.js'

export function registerSystemLogsHook(app: FastifyInstance) {
  app.addHook('onResponse', async (request, reply) => {
    if (isHealthPath(request.routeOptions.url) || request.routeOptions.url?.includes('/logs/')) return

    const user = request.user
    const statusCode = reply.statusCode
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'info'

    try {
      // Travessia declarada: requisição sem sessão grava com empresa nula.
      await comEscopoDePlataforma(async () => {
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
      })
    } catch (error) {
      request.log.error({ error }, 'Falha ao persistir log do sistema')
    }
  })
}
