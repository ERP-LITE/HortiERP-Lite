import { api } from './api'
import type { Category, PaginatedResult } from '@/types'
import { fetchAllPages } from './paginatedOptions'

export interface CategoryInput {
  name: string
  description?: string
}

export interface ListCategoriesParams {
  page: number
  pageSize: number
  search?: string
}

export async function listCategories(params: ListCategoriesParams) {
  const { data } = await api.get<PaginatedResult<Category>>('/categories', { params })
  return data
}

export function listAllCategories(params: Omit<ListCategoriesParams, 'page' | 'pageSize'> = {}) {
  return fetchAllPages((page, pageSize) => listCategories({ ...params, page, pageSize }))
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

export async function deleteCategories(ids: string[]) {
  const { data } = await api.post<{ deleted: number }>('/categories/bulk-delete', { ids })
  return data
}
