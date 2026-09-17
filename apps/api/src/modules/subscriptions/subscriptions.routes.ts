import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/middlewares/auth.js'
import { publicSignupSchema } from '../companies/companies.schema.js'
import { getCompanySubscription, listActivePlans, signUpCompany } from './subscriptions.service.js'

export async function subscriptionsRoutes(app: FastifyInstance) {
  app.get('/plans', async () => {
    return listActivePlans()
  })

  // Freio por hora, e não por minuto como o do login: cada cadastro falso deixa empresa e usuário
  // no banco, enquanto uma senha errada não deixa nada.
  app.post(
    '/signup',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const data = publicSignupSchema.parse(request.body)
      const resultado = await signUpCompany(data)
      return reply.status(201).send(resultado)
    },
  )

  app.get('/subscription', { preHandler: authenticate }, async (request) => {
    return getCompanySubscription(request.user.companyId)
  })
}
