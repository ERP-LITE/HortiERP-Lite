import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import {
  cancelStockCountSchema,
  countStockCountItemSchema,
  createStockCountSchema,
  listStockCountItemsQuerySchema,
  listStockCountsQuerySchema,
} from './stock-counts.schema.js'
import {
  cancelStockCount,
  countStockCountItem,
  createStockCount,
  finishStockCount,
  getOpenStockCount,
  getStockCount,
  listStockCountItems,
  listStockCounts,
  reopenStockCount,
  reviewStockCount,
} from './stock-counts.service.js'

export async function stockCountsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/stock-counts', async (request) => {
    const query = listStockCountsQuerySchema.parse(request.query)
    return listStockCounts(request.user.companyId, query)
  })

  // Antes da rota com `:id` de propósito: "open" não é identificador.
  app.get('/stock-counts/open', async (request) => {
    return getOpenStockCount(request.user.companyId)
  })

  app.get<{ Params: { id: string } }>('/stock-counts/:id', async (request) => {
    return getStockCount(request.user.companyId, request.params.id)
  })

  app.get<{ Params: { id: string } }>('/stock-counts/:id/items', async (request) => {
    const query = listStockCountItemsQuerySchema.parse(request.query)
    return listStockCountItems(request.user.companyId, request.params.id, query)
  })

  app.post('/stock-counts', { preHandler: requireRole('admin', 'gerente') }, async (request, reply) => {
    const data = createStockCountSchema.parse(request.body)
    const contagem = await createStockCount(request.user.companyId, request.user.sub, data)
    return reply.status(201).send(contagem)
  })

  // Sem papel exigido: contar é o trabalho do operador andando pela loja. O que altera o estoque é o
  // encerramento, e esse continua restrito a admin e gerente, como o ajuste manual.
  app.patch<{ Params: { id: string; productId: string } }>(
    '/stock-counts/:id/items/:productId',
    async (request) => {
      const data = countStockCountItemSchema.parse(request.body)
      return countStockCountItem(
        request.user.companyId,
        request.user.sub,
        request.params.id,
        request.params.productId,
        data.countedQuantity,
      )
    },
  )

  app.post<{ Params: { id: string } }>(
    '/stock-counts/:id/review',
    { preHandler: requireRole('admin', 'gerente') },
    async (request) => {
      return reviewStockCount(request.user.companyId, request.user.sub, request.params.id)
    },
  )

  app.post<{ Params: { id: string } }>(
    '/stock-counts/:id/reopen',
    { preHandler: requireRole('admin', 'gerente') },
    async (request) => {
      return reopenStockCount(request.user.companyId, request.user.sub, request.params.id)
    },
  )

  app.post<{ Params: { id: string } }>(
    '/stock-counts/:id/finish',
    { preHandler: requireRole('admin', 'gerente') },
    async (request) => {
      return finishStockCount(request.user.companyId, request.user.sub, request.params.id)
    },
  )

  app.post<{ Params: { id: string } }>(
    '/stock-counts/:id/cancel',
    { preHandler: requireRole('admin', 'gerente') },
    async (request) => {
      const data = cancelStockCountSchema.parse(request.body)
      return cancelStockCount(request.user.companyId, request.user.sub, request.params.id, data)
    },
  )
}
