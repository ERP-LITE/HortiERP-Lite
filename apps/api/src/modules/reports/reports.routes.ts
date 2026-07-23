import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/middlewares/auth.js'
import { dateRangeQuerySchema } from './reports.schema.js'
import { getLossesReport, getStockByCategoryReport, getStockEntriesReport } from './reports.service.js'

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/reports/stock-by-category', async (request) => {
    return getStockByCategoryReport(request.user.companyId)
  })

  app.get('/reports/losses', async (request) => {
    const range = dateRangeQuerySchema.parse(request.query)
    return getLossesReport(request.user.companyId, range)
  })

  app.get('/reports/stock-entries', async (request) => {
    const range = dateRangeQuerySchema.parse(request.query)
    return getStockEntriesReport(request.user.companyId, range)
  })
}
