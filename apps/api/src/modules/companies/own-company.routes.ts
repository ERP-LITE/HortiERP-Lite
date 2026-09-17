import type { FastifyInstance } from 'fastify'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { companies } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { authenticate, requireRole } from '../../shared/middlewares/auth.js'

/**
 * Fica fora de `companies.routes.ts` porque lá tudo exige `super_admin`. Não precisa de travessia de
 * plataforma: a política de RLS já deixa a empresa da sessão ler a própria linha.
 */
export async function ownCompanyRoutes(app: FastifyInstance) {
  app.get('/company', { preHandler: [authenticate, requireRole('admin')] }, async (request) => {
    const [empresa] = await db
      .select({
        name: companies.name,
        legalName: companies.legalName,
        document: companies.document,
        stateRegistration: companies.stateRegistration,
        contactName: companies.contactName,
        contactEmail: companies.contactEmail,
        phone: companies.phone,
        postalCode: companies.postalCode,
        street: companies.street,
        addressNumber: companies.addressNumber,
        complement: companies.complement,
        district: companies.district,
        city: companies.city,
        state: companies.state,
      })
      .from(companies)
      .where(and(eq(companies.id, request.user.companyId), isNull(companies.deletedAt)))
      .limit(1)

    if (!empresa) throw AppError.notFound('Empresa não encontrada')

    return empresa
  })
}
