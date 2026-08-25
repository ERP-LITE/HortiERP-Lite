import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { access, mkdir } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { sql } from 'drizzle-orm'
import { env } from './shared/config/env.js'
import { HEALTH_PATHS } from './shared/config/health.js'
import { db } from './db/client.js'
import { registerRequestScope } from './db/requestScope.js'
import { errorHandler } from './shared/middlewares/errorHandler.js'
import { AppError } from './shared/errors/AppError.js'
import { formatRetryDelay } from './shared/errors/frameworkMessages.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { companiesRoutes } from './modules/companies/companies.routes.js'
import { categoriesRoutes } from './modules/categories/categories.routes.js'
import { unitsRoutes } from './modules/units/units.routes.js'
import { productsRoutes } from './modules/products/products.routes.js'
import { usersRoutes } from './modules/users/users.routes.js'
import { stockEntriesRoutes } from './modules/stock-entries/stock-entries.routes.js'
import { stockRoutes } from './modules/stock/stock.routes.js'
import { lossesRoutes } from './modules/losses/losses.routes.js'
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js'
import { reportsRoutes } from './modules/reports/reports.routes.js'
import { logsRoutes } from './modules/logs/logs.routes.js'
import { registerSystemLogsHook } from './modules/logs/logs.hook.js'
import { billingsRoutes } from './modules/billings/billings.routes.js'

export function buildApp(options: { systemLogs?: boolean } = {}) {
  const app = Fastify({
    trustProxy: env.TRUST_PROXY,
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
          : undefined,
    },
  })

  app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })

  app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    allowList: (request) =>
      env.NODE_ENV !== 'production' && request.headers['user-agent'] === 'HortiERP-Load-Test/1.0',
    errorResponseBuilder: (_request, context) =>
      new AppError(
        `Muitas tentativas em pouco tempo. Tente novamente em ${formatRetryDelay(context.ttl)}.`,
        context.statusCode,
        context.ban ? 'RATE_LIMIT_BANNED' : 'RATE_LIMITED',
      ),
  })

  app.register(cookie)

  app.register(multipart, {
    limits: {
      files: 1,
      fileSize: env.INVOICE_MAX_FILE_SIZE,
    },
  })

  app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  })

  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler(async () => {
    throw AppError.notFound('Endereço não encontrado')
  })
  if (options.systemLogs !== false) registerSystemLogsHook(app)
  // Depois do log de propósito: hooks `onResponse` correm na ordem de registro, e o log escreve no
  // banco antes de a conexão ser devolvida.
  registerRequestScope(app)

  for (const healthPath of HEALTH_PATHS) {
    app.get(healthPath, async (_request, reply) => {
      try {
        await db.execute(sql`select 1`)
        await mkdir(env.INVOICE_STORAGE_PATH, { recursive: true, mode: 0o700 })
        await access(env.INVOICE_STORAGE_PATH, fsConstants.W_OK)
        return { status: 'ok', checks: { database: 'ok', invoiceStorage: 'ok' } }
      } catch (error) {
        app.log.error({ error }, 'Health check de dependências falhou')
        return reply.status(503).send({ status: 'error' })
      }
    })
  }

  app.register(authRoutes, { prefix: '/api' })
  app.register(companiesRoutes, { prefix: '/api' })
  app.register(categoriesRoutes, { prefix: '/api' })
  app.register(unitsRoutes, { prefix: '/api' })
  app.register(productsRoutes, { prefix: '/api' })
  app.register(usersRoutes, { prefix: '/api' })
  app.register(stockEntriesRoutes, { prefix: '/api' })
  app.register(stockRoutes, { prefix: '/api' })
  app.register(lossesRoutes, { prefix: '/api' })
  app.register(dashboardRoutes, { prefix: '/api' })
  app.register(reportsRoutes, { prefix: '/api' })
  app.register(logsRoutes, { prefix: '/api' })
  app.register(billingsRoutes, { prefix: '/api' })

  return app
}
