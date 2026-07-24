import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import { createUnitSchema, listUnitsQuerySchema, updateUnitSchema } from './units.schema.js'
import { createUnit, deleteUnit, getUnit, listUnits, updateUnit } from './units.service.js'

export async function unitsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/units', async (request) => {
    const query = listUnitsQuerySchema.parse(request.query)
    return listUnits(request.user.companyId, query)
  })

  app.get<{ Params: { id: string } }>('/units/:id', async (request) => {
    return getUnit(request.user.companyId, request.params.id)
  })

  app.post('/units', { preHandler: requireRole('admin', 'gerente') }, async (request, reply) => {
    const data = createUnitSchema.parse(request.body)
    const unit = await createUnit(request.user.companyId, request.user.sub, data)
    return reply.status(201).send(unit)
  })

  app.put<{ Params: { id: string } }>(
    '/units/:id',
    { preHandler: requireRole('admin', 'gerente') },
    async (request) => {
      const data = updateUnitSchema.parse(request.body)
      return updateUnit(request.user.companyId, request.user.sub, request.params.id, data)
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/units/:id',
    { preHandler: requireRole('admin', 'gerente') },
    async (request, reply) => {
      await deleteUnit(request.user.companyId, request.user.sub, request.params.id)
      return reply.status(204).send()
    },
  )
}
