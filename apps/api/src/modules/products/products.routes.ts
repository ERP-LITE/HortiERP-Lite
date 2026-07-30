import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import { bulkDeleteSchema } from '../../shared/schemas/bulk-delete.schema.js'
import { createProductSchema, listProductsQuerySchema, updateProductSchema } from './products.schema.js'
import { createProduct, deleteProduct, deleteProducts, getProduct, listProducts, updateProduct } from './products.service.js'

export async function productsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/products', async (request) => {
    const query = listProductsQuerySchema.parse(request.query)
    return listProducts(request.user.companyId, query)
  })

  app.get<{ Params: { id: string } }>('/products/:id', async (request) => {
    return getProduct(request.user.companyId, request.params.id)
  })

  app.post('/products', { preHandler: requireRole('admin', 'gerente') }, async (request, reply) => {
    const data = createProductSchema.parse(request.body)
    const product = await createProduct(request.user.companyId, request.user.sub, data)
    return reply.status(201).send(product)
  })

  app.post('/products/bulk-delete', { preHandler: requireRole('admin', 'gerente') }, async (request) => {
    const { ids } = bulkDeleteSchema.parse(request.body)
    return deleteProducts(request.user.companyId, request.user.sub, ids)
  })

  app.put<{ Params: { id: string } }>(
    '/products/:id',
    { preHandler: requireRole('admin', 'gerente') },
    async (request) => {
      const data = updateProductSchema.parse(request.body)
      return updateProduct(request.user.companyId, request.user.sub, request.params.id, data)
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/products/:id',
    { preHandler: requireRole('admin', 'gerente') },
    async (request, reply) => {
      await deleteProduct(request.user.companyId, request.user.sub, request.params.id)
      return reply.status(204).send()
    },
  )
}
