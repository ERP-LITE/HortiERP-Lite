import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/middlewares/auth.js'
import { listCurrentStock, listStockMovements } from './stock.service.js'

export async function stockRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/stock', async (request) => {
    return listCurrentStock(request.user.companyId)
  })

  app.get<{ Querystring: { productId?: string } }>('/stock/movements', async (request) => {
    return listStockMovements(request.user.companyId, request.query.productId)
  })
}
