import axios from 'axios'

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
