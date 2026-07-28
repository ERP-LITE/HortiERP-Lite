import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export async function verifyTurnstileToken(token: string | undefined, remoteIp?: string) {
  if (!token) {
    throw new AppError('Verificação de segurança obrigatória', 400, 'TURNSTILE_MISSING')
  }

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  const response = await fetch(VERIFY_URL, { method: 'POST', body })
  const result = (await response.json()) as { success: boolean }

  if (!result.success) {
    throw new AppError('Falha na verificação de segurança, tente novamente', 400, 'TURNSTILE_FAILED')
  }
}
