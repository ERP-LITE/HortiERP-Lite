import { api } from './api'
import type { PaginatedResult, User } from '@/types'

export interface PlatformUserInput {
  name: string
  email: string
  password?: string
}

export async function listPlatformUsers(params: { page: number; pageSize: number; search?: string }) {
  const { data } = await api.get<PaginatedResult<User>>('/platform-users', { params })
  return data
}

export async function createPlatformUser(payload: PlatformUserInput) {
  const { data } = await api.post<User>('/platform-users', payload)
  return data
}

export async function updatePlatformUser(id: string, payload: Partial<PlatformUserInput>) {
  const { data } = await api.put<User>(`/platform-users/${id}`, payload)
  return data
}

export async function deletePlatformUser(id: string) {
  await api.delete(`/platform-users/${id}`)
}
