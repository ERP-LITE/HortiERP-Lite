import axios from 'axios'
import { ref } from 'vue'
import type { ApiErrorPayload } from '@/types'

declare module 'axios' {
  export interface AxiosRequestConfig {
    suppressSessionEndedRedirect?: boolean
  }

  export interface InternalAxiosRequestConfig {
    suppressSessionEndedRedirect?: boolean
  }
}

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  withCredentials: true,
})

export const pendingApiRequests = ref(0)

api.interceptors.request.use(
  (config) => {
    pendingApiRequests.value += 1
    return config
  },
  (error) => Promise.reject(error),
)

let redirectingToLogin = false

api.interceptors.response.use(
  (response) => {
    pendingApiRequests.value = Math.max(0, pendingApiRequests.value - 1)
    return response
  },
  (error) => {
    pendingApiRequests.value = Math.max(0, pendingApiRequests.value - 1)
    if (
      error.response?.status === 401 &&
      !error.config?.suppressSessionEndedRedirect &&
      window.location.pathname !== '/login'
    ) {
      if (!redirectingToLogin) {
        redirectingToLogin = true
        window.location.replace('/login?reason=session-ended')
      }
    }

    return Promise.reject(error)
  },
)

export function isConnectionError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response && error.code !== 'ERR_CANCELED'
}

export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado'): string {
  if (isConnectionError(error)) {
    return 'Não foi possível se conectar ao servidor. Verifique sua conexão e tente novamente.'
  }

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
