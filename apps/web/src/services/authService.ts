import { api } from './api'
import type { AuthUser } from '@/types'

export interface LoginResponse {
  user: AuthUser
}

export async function login(email: string, password: string, turnstileToken: string) {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password, turnstileToken })
  return data
}

export async function logout() {
  await api.post('/auth/logout')
}

export async function fetchMe() {
  const { data } = await api.get<{ user: AuthUser }>('/auth/me')
  return data.user
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await api.patch('/auth/password', { currentPassword, newPassword })
}
