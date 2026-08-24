import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/middlewares/auth.js'
import { clearSessionCookie, issueSession } from '../../shared/auth/session.js'
import { AppError } from '../../shared/errors/AppError.js'
import { getCompany } from '../companies/companies.service.js'
import { changePasswordSchema, loginSchema } from './auth.schema.js'
import { authenticateUser, changeOwnPassword, getUserProfile } from './auth.service.js'
import { exportOwnPersonalData } from './personal-data.service.js'

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { email, password } = loginSchema.parse(request.body)

      const user = await authenticateUser(email, password)

      await issueSession(reply, user)

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
        impersonating: false,
        companyName: user.company.name,
      }
    },
  )

  app.post('/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply)
    return { success: true }
  })

  app.get('/auth/me', { preHandler: [authenticate] }, async (request) => {
    const user = await getUserProfile(request.user.realCompanyId ?? request.user.companyId, request.user.sub)
    const impersonating = Boolean(request.user.realCompanyId)
    const companyName = impersonating ? (await getCompany(request.user.companyId)).name : user.company.name

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: request.user.role,
        companyId: request.user.companyId,
      },
      impersonating,
      companyName,
    }
  })

  app.post('/auth/exit-impersonation', { preHandler: [authenticate] }, async (request, reply) => {
    if (!request.user.realCompanyId) {
      throw AppError.conflict('Você não está em modo de acesso a outra empresa')
    }

    const user = await getUserProfile(request.user.realCompanyId, request.user.sub)

    await issueSession(reply, { id: user.id, companyId: user.companyId, role: user.role })

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
      impersonating: false,
      companyName: user.company.name,
    }
  })

  app.get(
    '/auth/me/personal-data',
    { preHandler: [authenticate], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const data = await exportOwnPersonalData(
        request.user.realCompanyId ?? request.user.companyId,
        request.user.sub,
      )

      const date = new Date().toISOString().slice(0, 10)
      reply.header('content-disposition', `attachment; filename="meus-dados-${date}.json"`)
      return data
    },
  )

  app.patch(
    '/auth/password',
    { preHandler: [authenticate], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const { currentPassword, newPassword } = changePasswordSchema.parse(request.body)

      await changeOwnPassword(
        request.user.realCompanyId ?? request.user.companyId,
        request.user.sub,
        currentPassword,
        newPassword,
      )

      return { success: true }
    },
  )
}
