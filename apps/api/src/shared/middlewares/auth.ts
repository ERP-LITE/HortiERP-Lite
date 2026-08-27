import type { FastifyRequest } from 'fastify'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { comEscopoDePlataforma, usarEmpresa } from '../../db/scope.js'
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

  // Travessia declarada: durante impersonação o usuário validado é de outra empresa.
  const { user, targetCompany } = await comEscopoDePlataforma(async () => {
    const [encontrado] = await db
      .select({ role: users.role, passwordChangedAt: users.passwordChangedAt })
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

    if (!request.user.realCompanyId) return { user: encontrado, targetCompany: undefined }

    const [alvo] = await db
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

    return { user: encontrado, targetCompany: alvo }
  })

  const roleIsValid = request.user.realCompanyId
    ? user?.role === 'super_admin' && request.user.role === 'admin'
    : user?.role === request.user.role

  if (!user || !roleIsValid) {
    throw AppError.unauthorized('Sessão inválida ou acesso desativado')
  }

  if (request.user.realCompanyId && !targetCompany) {
    throw AppError.unauthorized('Sessão inválida ou acesso desativado')
  }

  if (senhaTrocadaDepoisDoToken(user.passwordChangedAt, request.user.iat)) {
    throw AppError.unauthorized('Sua senha foi alterada. Entre de novo.')
  }

  // Único ponto onde a conexão da requisição ganha uma empresa.
  await usarEmpresa(request.user.companyId)
}

/**
 * O `iat` do JWT vem em segundos inteiros, então a comparação também é feita em segundos: em
 * milissegundos, o token reemitido no mesmo instante da troca nasceria "velho" e derrubaria a
 * própria pessoa que acabou de trocar a senha.
 */
function senhaTrocadaDepoisDoToken(passwordChangedAt: Date | null, tokenEmitidoEm: number) {
  if (!passwordChangedAt) return false
  return tokenEmitidoEm < Math.floor(passwordChangedAt.getTime() / 1000)
}

export function requireRole(...roles: Array<'admin' | 'gerente' | 'operador' | 'super_admin'>) {
  return async function (request: FastifyRequest) {
    if (!roles.includes(request.user.role)) {
      throw AppError.forbidden('Você não tem permissão para executar esta ação')
    }
  }
}
