import type { FastifyInstance } from 'fastify'
import { env } from '../../shared/config/env.js'
import { authenticate } from '../../shared/middlewares/auth.js'
import { verifyTurnstileToken } from '../../shared/security/verifyTurnstile.js'
import { parseDurationToSeconds } from '../../shared/utils/duration.js'
import { changePasswordSchema, loginSchema } from './auth.schema.js'
import { authenticateUser, changeOwnPassword, getUserProfile } from './auth.service.js'

const AUTH_COOKIE_NAME = 'token'
const AUTH_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
}

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { email, password, turnstileToken } = loginSchema.parse(request.body)

      await verifyTurnstileToken(turnstileToken, request.ip)

      const user = await authenticateUser(email, password)

      const token = await reply.jwtSign(
        { sub: user.id, companyId: user.companyId, role: user.role },
        { expiresIn: env.JWT_EXPIRES_IN },
      )

      reply.setCookie(AUTH_COOKIE_NAME, token, {
        ...AUTH_COOKIE_OPTIONS,
        maxAge: parseDurationToSeconds(env.JWT_EXPIRES_IN),
      })

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
      }
    },
  )

  app.post('/auth/logout', { preHandler: [authenticate] }, async (_request, reply) => {
    reply.clearCookie(AUTH_COOKIE_NAME, { path: '/' })
    return { success: true }
  })

  app.get('/auth/me', { preHandler: [authenticate] }, async (request) => {
    const user = await getUserProfile(request.user.companyId, request.user.sub)

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    }
  })

  app.patch(
    '/auth/password',
    { preHandler: [authenticate], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const { currentPassword, newPassword } = changePasswordSchema.parse(request.body)

      await changeOwnPassword(request.user.companyId, request.user.sub, currentPassword, newPassword)

      return { success: true }
    },
  )
}
