import { api } from './api'
import type { AuthUser } from '@/types'

export interface LoginResponse {
  token: string
  user: AuthUser
}

export async function login(email: string, password: string) {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
  return data
}

export async function fetchMe() {
  const { data } = await api.get<{ user: AuthUser }>('/auth/me')
  return data.user
}
