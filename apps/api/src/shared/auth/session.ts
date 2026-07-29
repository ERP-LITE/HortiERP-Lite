import type { FastifyReply } from 'fastify'
import { env } from '../config/env.js'
import { parseDurationToSeconds } from '../utils/duration.js'

export const AUTH_COOKIE_NAME = 'token'

export const AUTH_COOKIE_OPTIONS = {
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
