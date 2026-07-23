import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import { createCategorySchema, updateCategorySchema } from './categories.schema.js'
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from './categories.service.js'

export async function categoriesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/categories', async (request) => {
    return listCategories(request.user.companyId)
  })

  app.get<{ Params: { id: string } }>('/categories/:id', async (request) => {
    return getCategory(request.user.companyId, request.params.id)
  })

  app.post('/categories', { preHandler: requireRole('admin', 'gerente') }, async (request, reply) => {
    const data = createCategorySchema.parse(request.body)
    const category = await createCategory(request.user.companyId, request.user.sub, data)
    return reply.status(201).send(category)
  })

  app.put<{ Params: { id: string } }>(
    '/categories/:id',
    { preHandler: requireRole('admin', 'gerente') },
    async (request) => {
      const data = updateCategorySchema.parse(request.body)
      return updateCategory(request.user.companyId, request.user.sub, request.params.id, data)
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/categories/:id',
    { preHandler: requireRole('admin', 'gerente') },
    async (request, reply) => {
      await deleteCategory(request.user.companyId, request.user.sub, request.params.id)
      return reply.status(204).send()
    },
  )
}
