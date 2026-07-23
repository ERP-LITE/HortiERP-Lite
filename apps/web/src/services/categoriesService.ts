import { api } from './api'
import type { Category } from '@/types'

export interface CategoryInput {
  name: string
  description?: string
}

export async function listCategories() {
  const { data } = await api.get<Category[]>('/categories')
  return data
}

export async function createCategory(payload: CategoryInput) {
  const { data } = await api.post<Category>('/categories', payload)
  return data
}

export async function updateCategory(id: string, payload: CategoryInput) {
  const { data } = await api.put<Category>(`/categories/${id}`, payload)
  return data
}

export async function deleteCategory(id: string) {
  await api.delete(`/categories/${id}`)
}
