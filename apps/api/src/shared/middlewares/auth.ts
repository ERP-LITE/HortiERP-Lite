import type { FastifyRequest } from 'fastify'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { companies, users } from '../../db/schema/index.js'
import { AppError } from '../errors/AppError.js'

export async function authenticate(request: FastifyRequest) {
  try {
    await request.jwtVerify()
  } catch {
    throw AppError.unauthorized('Token inválido ou expirado')
  }

  if (request.user.realCompanyId && request.user.realCompanyId === request.user.companyId) {
    throw AppError.unauthorized('Sessão inválida ou acesso desativado')
  }

  const realCompanyId = request.user.realCompanyId ?? request.user.companyId
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .innerJoin(companies, eq(companies.id, users.companyId))
    .where(
      and(
        eq(users.id, request.user.sub),
        eq(users.companyId, realCompanyId),
        eq(users.active, true),
        isNull(users.deletedAt),
        eq(companies.active, true),
        isNull(companies.deletedAt),
      ),
    )
    .limit(1)

  const roleIsValid = request.user.realCompanyId
    ? user?.role === 'super_admin' && request.user.role === 'admin'
    : user?.role === request.user.role

  if (!user || !roleIsValid) {
    throw AppError.unauthorized('Sessão inválida ou acesso desativado')
  }

  if (request.user.realCompanyId) {
    const [targetCompany] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.id, request.user.companyId),
          eq(companies.active, true),
          isNull(companies.deletedAt),
        ),
      )
      .limit(1)

    if (!targetCompany) {
      throw AppError.unauthorized('Sessão inválida ou acesso desativado')
    }
  }
}

export function requireRole(...roles: Array<'admin' | 'gerente' | 'operador' | 'super_admin'>) {
  return async function (request: FastifyRequest) {
    if (!roles.includes(request.user.role)) {
      throw AppError.forbidden('Você não tem permissão para executar esta ação')
    }
  }
}
