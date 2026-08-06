import { api } from './api'
import type { PaginatedResult, User, UserRole } from '@/types'

export interface UserInput {
  name: string
  email: string
  password?: string
  role: UserRole
  active: boolean
}

export interface ListUsersParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page: number
  pageSize: number
  search?: string
  role?: UserRole
  active?: boolean
}

export async function listUsers(params: ListUsersParams) {
  const { data } = await api.get<PaginatedResult<User>>('/users', { params })
  return data
}

export async function createUser(payload: UserInput) {
  const { data } = await api.post<User>('/users', payload)
  return data
}

export async function updateUser(id: string, payload: Partial<UserInput>) {
  const { data } = await api.put<User>(`/users/${id}`, payload)
  return data
}

export async function deleteUser(id: string) {
  await api.delete(`/users/${id}`)
}

export async function deleteUsers(ids: string[]) {
  const { data } = await api.post<{ deleted: number }>('/users/bulk-delete', { ids })
  return data
}
