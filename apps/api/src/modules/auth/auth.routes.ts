import type { FastifyInstance } from 'fastify'
import { env } from '../../shared/config/env.js'
import { authenticate } from '../../shared/middlewares/auth.js'
import { changePasswordSchema, loginSchema } from './auth.schema.js'
import { authenticateUser, changeOwnPassword, getUserProfile } from './auth.service.js'

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body)

    const user = await authenticateUser(email, password)

    const token = await reply.jwtSign(
      { sub: user.id, companyId: user.companyId, role: user.role },
      { expiresIn: env.JWT_EXPIRES_IN },
    )

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    }
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

  app.patch('/auth/password', { preHandler: [authenticate] }, async (request) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body)

    await changeOwnPassword(request.user.companyId, request.user.sub, currentPassword, newPassword)

    return { success: true }
  })
}
