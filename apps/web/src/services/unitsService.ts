import { api } from './api'
import type { PaginatedResult, Unit } from '@/types'
import { fetchAllPages } from './paginatedOptions'

export interface UnitInput {
  name: string
  abbreviation: string
}

export interface ListUnitsParams {
  page: number
  pageSize: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export async function listUnits(params: ListUnitsParams) {
  const { data } = await api.get<PaginatedResult<Unit>>('/units', { params })
  return data
}

export function listAllUnits(params: Omit<ListUnitsParams, 'page' | 'pageSize'> = {}) {
  return fetchAllPages((page, pageSize) => listUnits({ ...params, page, pageSize }))
}

export async function createUnit(payload: UnitInput) {
  const { data } = await api.post<Unit>('/units', payload)
  return data
}

export async function updateUnit(id: string, payload: UnitInput) {
  const { data } = await api.put<Unit>(`/units/${id}`, payload)
  return data
}

export async function deleteUnit(id: string) {
  await api.delete(`/units/${id}`)
}

export async function deleteUnits(ids: string[]) {
  const { data } = await api.post<{ deleted: number }>('/units/bulk-delete', { ids })
  return data
}
