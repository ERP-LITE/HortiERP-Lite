import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/middlewares/auth.js'
import { createLossSchema } from './losses.schema.js'
import { createLoss, getLoss, listLosses } from './losses.service.js'

export async function lossesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/losses', async (request) => {
    return listLosses(request.user.companyId)
  })

  app.get<{ Params: { id: string } }>('/losses/:id', async (request) => {
    return getLoss(request.user.companyId, request.params.id)
  })

  app.post('/losses', async (request, reply) => {
    const data = createLossSchema.parse(request.body)
    const loss = await createLoss(request.user.companyId, request.user.sub, data)
    return reply.status(201).send(loss)
  })
}
