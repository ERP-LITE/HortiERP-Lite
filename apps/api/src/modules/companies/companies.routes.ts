import type { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'
import { issueSession } from '../../shared/auth/session.js'
import { getUserProfile } from '../auth/auth.service.js'
import {
  createCompanySchema,
  listCompaniesQuerySchema,
  setCompanyActiveSchema,
  updateCompanySchema,
} from './companies.schema.js'
import {
  assertCompanyAccessible,
  createCompanyWithAdmin,
  getCompany,
  listCompanies,
  setCompanyActive,
  updateCompany,
} from './companies.service.js'

export async function companiesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', requireRole('super_admin'))

  app.get('/companies', async (request) => {
    const query = listCompaniesQuerySchema.parse(request.query)
    return listCompanies(query)
  })

  app.get<{ Params: { id: string } }>('/companies/:id', async (request) => {
    return getCompany(request.params.id)
  })

  app.post('/companies', async (request, reply) => {
    const data = createCompanySchema.parse(request.body)
    const result = await createCompanyWithAdmin(data)
    return reply.status(201).send(result)
  })

  app.put<{ Params: { id: string } }>('/companies/:id', async (request) => {
    const data = updateCompanySchema.parse(request.body)
    return updateCompany(request.params.id, data)
  })

  app.patch<{ Params: { id: string } }>('/companies/:id/active', async (request) => {
    const { active } = setCompanyActiveSchema.parse(request.body)
    return setCompanyActive(request.params.id, active)
  })

  app.post<{ Params: { id: string } }>('/companies/:id/impersonate', async (request, reply) => {
    const company = await assertCompanyAccessible(request.params.id)
    const superAdmin = await getUserProfile(request.user.companyId, request.user.sub)

    await issueSession(reply, {
      id: superAdmin.id,
      companyId: company.id,
      role: 'admin',
      realCompanyId: superAdmin.companyId,
    })

    return {
      user: {
        id: superAdmin.id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: 'admin' as const,
        companyId: company.id,
      },
      impersonating: true,
      companyName: company.name,
    }
  })
}
