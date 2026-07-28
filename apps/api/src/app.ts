import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { env } from './shared/config/env.js'
import { errorHandler } from './shared/middlewares/errorHandler.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { categoriesRoutes } from './modules/categories/categories.routes.js'
import { unitsRoutes } from './modules/units/units.routes.js'
import { productsRoutes } from './modules/products/products.routes.js'
import { usersRoutes } from './modules/users/users.routes.js'
import { stockEntriesRoutes } from './modules/stock-entries/stock-entries.routes.js'
import { stockRoutes } from './modules/stock/stock.routes.js'
import { lossesRoutes } from './modules/losses/losses.routes.js'
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js'
import { reportsRoutes } from './modules/reports/reports.routes.js'

export function buildApp() {
  const app = Fastify({
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
  })

  app.register(cookie)

  app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  })

  app.setErrorHandler(errorHandler)

  app.get('/health', async () => ({ status: 'ok' }))

  app.register(authRoutes, { prefix: '/api' })
  app.register(categoriesRoutes, { prefix: '/api' })
  app.register(unitsRoutes, { prefix: '/api' })
  app.register(productsRoutes, { prefix: '/api' })
  app.register(usersRoutes, { prefix: '/api' })
  app.register(stockEntriesRoutes, { prefix: '/api' })
  app.register(stockRoutes, { prefix: '/api' })
  app.register(lossesRoutes, { prefix: '/api' })
  app.register(dashboardRoutes, { prefix: '/api' })
  app.register(reportsRoutes, { prefix: '/api' })

  return app
}
