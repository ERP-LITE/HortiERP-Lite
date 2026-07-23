import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import { createUserSchema, updateUserSchema } from './users.schema.js'
import { createUser, deleteUser, getUser, listUsers, updateUser } from './users.service.js'

export async function usersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', requireRole('admin'))

  app.get('/users', async (request) => {
    return listUsers(request.user.companyId)
  })

  app.get<{ Params: { id: string } }>('/users/:id', async (request) => {
    return getUser(request.user.companyId, request.params.id)
  })

  app.post('/users', async (request, reply) => {
    const data = createUserSchema.parse(request.body)
    const user = await createUser(request.user.companyId, request.user.sub, data)
    return reply.status(201).send(user)
  })

  app.put<{ Params: { id: string } }>('/users/:id', async (request) => {
    const data = updateUserSchema.parse(request.body)
    return updateUser(request.user.companyId, request.user.sub, request.params.id, data)
  })

  app.delete<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    await deleteUser(request.user.companyId, request.user.sub, request.params.id)
    return reply.status(204).send()
  })
}
