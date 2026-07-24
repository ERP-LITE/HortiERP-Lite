import { api } from './api'
import type { PaginatedResult, Unit } from '@/types'

export interface UnitInput {
  name: string
  abbreviation: string
}

export interface ListUnitsParams {
  page: number
  pageSize: number
  search?: string
}

export async function listUnits(params: ListUnitsParams) {
  const { data } = await api.get<PaginatedResult<Unit>>('/units', { params })
  return data
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
