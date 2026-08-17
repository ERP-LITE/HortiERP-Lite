import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import { cancelLossSchema, createLossSchema, listLossesQuerySchema, updateLossSchema } from './losses.schema.js'
import { cancelLoss, createLoss, getLoss, listLosses, updateLoss } from './losses.service.js'

export async function lossesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/losses', async (request) => {
    const query = listLossesQuerySchema.parse(request.query)
    return listLosses(request.user.companyId, query)
  })

  app.get<{ Params: { id: string } }>('/losses/:id', async (request) => {
    return getLoss(request.user.companyId, request.params.id)
  })

  app.post('/losses', async (request, reply) => {
    const data = createLossSchema.parse(request.body)
    const loss = await createLoss(request.user.companyId, request.user.sub, data)
    return reply.status(201).send(loss)
  })

  app.patch<{ Params: { id: string } }>(
    '/losses/:id',
    { preHandler: requireRole('admin', 'gerente') },
    async (request) => {
      const data = updateLossSchema.parse(request.body)
      return updateLoss(request.user.companyId, request.user.sub, request.params.id, data)
    },
  )

  app.post<{ Params: { id: string } }>(
    '/losses/:id/cancel',
    { preHandler: requireRole('admin', 'gerente') },
    async (request) => {
      const data = cancelLossSchema.parse(request.body)
      return cancelLoss(request.user.companyId, request.user.sub, request.params.id, data)
    },
  )
}
