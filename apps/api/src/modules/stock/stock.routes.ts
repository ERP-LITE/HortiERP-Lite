import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/middlewares/auth.js'
import { listStockMovementsQuerySchema, listStockQuerySchema } from './stock.schema.js'
import { listCurrentStock, listStockMovements } from './stock.service.js'

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
}
