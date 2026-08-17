import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import {
  createStockEntrySchema,
  listStockEntriesQuerySchema,
  updateStockEntryDetailsSchema,
} from './stock-entries.schema.js'
import {
  createStockEntry,
  deleteStockEntryAttachment,
  getStockEntry,
  getStockEntryAttachment,
  listStockEntries,
  updateStockEntryDetails,
} from './stock-entries.service.js'
import { deleteInvoiceFile, isPreviewableInvoiceFile, openInvoiceFile, storeInvoiceAttachment } from './invoice-storage.js'
import { AppError } from '../../shared/errors/AppError.js'

export async function stockEntriesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/stock-entries', async (request) => {
    const query = listStockEntriesQuerySchema.parse(request.query)
    return listStockEntries(request.user.companyId, query)
  })

  app.get<{ Params: { id: string } }>('/stock-entries/:id', async (request) => {
    return getStockEntry(request.user.companyId, request.params.id)
  })

  app.post('/stock-entries', async (request, reply) => {
    const data = createStockEntrySchema.parse(request.body)
    const entry = await createStockEntry(request.user.companyId, request.user.sub, data)
    return reply.status(201).send(entry)
  })

  app.patch<{ Params: { id: string } }>(
    '/stock-entries/:id',
    { preHandler: requireRole('admin', 'gerente') },
    async (request) => {
      const data = updateStockEntryDetailsSchema.parse(request.body)
      return updateStockEntryDetails(request.user.companyId, request.user.sub, request.params.id, data)
    },
  )

  app.post<{ Params: { id: string } }>(
    '/stock-entries/:id/attachments',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      await getStockEntry(request.user.companyId, request.params.id)
      const file = await request.file()
      if (!file) throw new AppError('Arquivo não enviado', 422, 'FILE_REQUIRED')
      const attachment = await storeInvoiceAttachment(request.user.companyId, request.user.sub, request.params.id, file)
      return reply.status(201).send(attachment)
    },
  )

  app.get<{ Params: { id: string; attachmentId: string }; Querystring: { preview?: string } }>(
    '/stock-entries/:id/attachments/:attachmentId',
    async (request, reply) => {
      const attachment = await getStockEntryAttachment(
        request.user.companyId,
        request.params.id,
        request.params.attachmentId,
      )
      const preview = request.query.preview === 'true' && isPreviewableInvoiceFile(attachment.mimeType)
      const disposition = preview ? 'inline' : 'attachment'
      const encodedName = encodeURIComponent(attachment.originalName)

      reply.header('Content-Type', attachment.mimeType)
      reply.header('Content-Length', attachment.size)
      reply.header('X-Content-Type-Options', 'nosniff')
      reply.header('Content-Security-Policy', "default-src 'none'; sandbox")
      reply.header('Content-Disposition', `${disposition}; filename*=UTF-8''${encodedName}`)
      return reply.send(openInvoiceFile(attachment.storedName))
    },
  )

  app.delete<{ Params: { id: string; attachmentId: string } }>(
    '/stock-entries/:id/attachments/:attachmentId',
    { preHandler: requireRole('admin', 'gerente') },
    async (request, reply) => {
      const attachment = await deleteStockEntryAttachment(
        request.user.companyId,
        request.params.id,
        request.params.attachmentId,
      )
      await deleteInvoiceFile(attachment.storedName).catch((error) => {
        request.log.error({ error, attachmentId: request.params.attachmentId }, 'Falha ao remover arquivo órfão de anexo')
      })
      return reply.status(204).send()
    },
  )
}
