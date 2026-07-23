import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/middlewares/auth.js'
import { createStockEntrySchema } from './stock-entries.schema.js'
import { createStockEntry, getStockEntry, listStockEntries } from './stock-entries.service.js'

export async function stockEntriesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/stock-entries', async (request) => {
    return listStockEntries(request.user.companyId)
  })

  app.get<{ Params: { id: string } }>('/stock-entries/:id', async (request) => {
    return getStockEntry(request.user.companyId, request.params.id)
  })

  app.post('/stock-entries', async (request, reply) => {
    const data = createStockEntrySchema.parse(request.body)
    const entry = await createStockEntry(request.user.companyId, request.user.sub, data)
    return reply.status(201).send(entry)
  })
}
