import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import { permitirTravessiaDePlataforma } from '../../db/scope.js'
import { createBillingSchema, listBillingsQuerySchema, updateBillingSchema } from './billings.schema.js'
import { createBilling, deleteBilling, listBillings, updateBilling } from './billings.service.js'

export async function billingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', requireRole('super_admin'))
  app.addHook('preHandler', permitirTravessiaDePlataforma)

  app.get('/billings', async (request) => listBillings(listBillingsQuerySchema.parse(request.query)))

  app.post('/billings', async (request, reply) => {
    const billing = await createBilling(createBillingSchema.parse(request.body), request.user.sub)
    return reply.status(201).send(billing)
  })

  app.put<{ Params: { id: string } }>('/billings/:id', async (request) => {
    return updateBilling(request.params.id, updateBillingSchema.parse(request.body), request.user.sub)
  })

  app.delete<{ Params: { id: string } }>('/billings/:id', async (request, reply) => {
    await deleteBilling(request.params.id)
    return reply.status(204).send()
  })
}
