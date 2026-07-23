import axios from 'axios'
import type { ApiErrorPayload } from '@/types'

export const TOKEN_STORAGE_KEY = 'hortierp_token'

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
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

export function getApiFieldErrors(error: unknown): Record<string, string> {
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
 * Splits an API error into either per-field messages (when the backend
 * flagged specific fields) or a single fallback message, so form views don't
 * each repeat the same field-errors-vs-generic-message branching.
 */
export function resolveFormError(error: unknown, fallback: string): { fieldErrors: Record<string, string>; message: string } {
  const fieldErrors = getApiFieldErrors(error)
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, message: '' }
  }

  return { fieldErrors: {}, message: getApiErrorMessage(error, fallback) }
}
