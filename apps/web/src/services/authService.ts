import { api } from './api'
import { treguaDeSessao } from '@/lib/sessionRedirect'
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
  // Antes e depois: o cookie antigo morre no servidor no meio desta chamada, e o novo só existe no
  // navegador quando ela termina.
  treguaDeSessao.iniciar()
  try {
    await api.patch('/auth/password', { currentPassword, newPassword })
  } finally {
    treguaDeSessao.iniciar()
  }
}

export async function fetchOwnPersonalData() {
  const { data } = await api.get<Record<string, unknown>>('/auth/me/personal-data')
  return data
}
