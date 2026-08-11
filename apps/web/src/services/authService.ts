import { api } from './api'
import type { SessionResponse } from '@/types'

export async function login(email: string, password: string) {
  const { data } = await api.post<SessionResponse>('/auth/login', { email, password })
  return data
}

export async function logout() {
  await api.post('/auth/logout')
}

export async function fetchMe(suppressSessionEndedRedirect = false) {
  const { data } = await api.get<SessionResponse>('/auth/me', { suppressSessionEndedRedirect })
  return data
}

export async function exitImpersonation() {
  const { data } = await api.post<SessionResponse>('/auth/exit-impersonation')
  return data
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await api.patch('/auth/password', { currentPassword, newPassword })
}
