import type { FastifyReply, FastifyRequest } from 'fastify'
import { env } from '../config/env.js'
import { parseDurationToSeconds } from '../utils/duration.js'

export const AUTH_COOKIE_NAME = 'token'

const AUTH_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
}

interface SessionUser {
  id: string
  companyId: string
  role: 'admin' | 'gerente' | 'operador' | 'super_admin'
  realCompanyId?: string
}

export async function issueSession(reply: FastifyReply, user: SessionUser) {
  const token = await reply.jwtSign(
    {
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
      ...(user.realCompanyId ? { realCompanyId: user.realCompanyId } : {}),
    },
    { expiresIn: env.JWT_EXPIRES_IN },
  )

  reply.setCookie(AUTH_COOKIE_NAME, token, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: parseDurationToSeconds(env.JWT_EXPIRES_IN),
  })
}

/**
 * Reemite o cookie da sessão atual, preservando impersonação. Toda rota que grava a senha **do
 * próprio solicitante** precisa chamar isto: `users.password_changed_at` invalida os tokens antigos,
 * e sem o cookie novo quem trocou a senha cai no login. Vale para a tela de perfil e para as telas
 * de edição de usuário, onde a pessoa pode editar o próprio registro.
 */
export async function renewSession(request: FastifyRequest, reply: FastifyReply) {
  await issueSession(reply, {
    id: request.user.sub,
    companyId: request.user.companyId,
    role: request.user.role,
    ...(request.user.realCompanyId ? { realCompanyId: request.user.realCompanyId } : {}),
  })
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS)
}
