import { api } from './api'
import type { User, UserRole } from '@/types'

export interface UserInput {
  name: string
  email: string
  password?: string
  role: UserRole
  active: boolean
}

export async function listUsers() {
  const { data } = await api.get<User[]>('/users')
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
