import type { FastifyRequest } from 'fastify'
import { AppError } from '../errors/AppError.js'

export async function authenticate(request: FastifyRequest) {
  try {
    await request.jwtVerify()
  } catch {
    throw AppError.unauthorized('Token inválido ou expirado')
  }
}

export function requireRole(...roles: Array<'admin' | 'gerente' | 'operador'>) {
  return async function (request: FastifyRequest) {
    if (!roles.includes(request.user.role)) {
      throw AppError.forbidden('Você não tem permissão para executar esta ação')
    }
  }
}
