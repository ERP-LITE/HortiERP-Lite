import axios from 'axios'
import type { ApiErrorPayload } from '@/types'

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  withCredentials: true,
})

let redirectingToLogin = false

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      if (!redirectingToLogin) {
        redirectingToLogin = true
        window.location.replace('/login?reason=session-ended')
      }
    }

    return Promise.reject(error)
  },
)

export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado'): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message ?? fallback
  }

  return fallback
}

function getApiFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) return {}

  const issues = (error.response?.data as ApiErrorPayload | undefined)?.error?.issues
  if (!issues) return {}

  const fieldErrors: Record<string, string> = {}
  for (const [field, messages] of Object.entries(issues)) {
    if (messages && messages.length > 0) fieldErrors[field] = messages[0]
  }

  return fieldErrors
}

/**
 * Separa um erro da API em mensagens por campo (quando o backend indicou
 * campos específicos) ou em uma única mensagem alternativa, evitando que
 * cada formulário repita a mesma decisão entre erros de campo e erro genérico.
 */
export function resolveFormError(error: unknown, fallback: string): { fieldErrors: Record<string, string>; message: string } {
  const fieldErrors = getApiFieldErrors(error)
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, message: '' }
  }

  return { fieldErrors: {}, message: getApiErrorMessage(error, fallback) }
}
