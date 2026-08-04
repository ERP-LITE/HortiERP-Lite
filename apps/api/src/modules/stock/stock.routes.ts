import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import { createStockAdjustmentSchema, listStockMovementsQuerySchema, listStockQuerySchema } from './stock.schema.js'
import { createStockAdjustment, listCurrentStock, listStockMovements } from './stock.service.js'

export async function stockRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/stock', async (request) => {
    const query = listStockQuerySchema.parse(request.query)
    return listCurrentStock(request.user.companyId, query)
  })

  app.get('/stock/movements', async (request) => {
    const query = listStockMovementsQuerySchema.parse(request.query)
    return listStockMovements(request.user.companyId, query)
  })

  app.post('/stock/adjust', { preHandler: requireRole('admin', 'gerente') }, async (request, reply) => {
    const data = createStockAdjustmentSchema.parse(request.body)
    const movement = await createStockAdjustment(request.user.companyId, request.user.sub, data)
    return reply.status(201).send(movement)
  })
}
