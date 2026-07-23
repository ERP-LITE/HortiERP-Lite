import { api } from './api'
import type { Unit } from '@/types'

export interface UnitInput {
  name: string
  abbreviation: string
}

export async function listUnits() {
  const { data } = await api.get<Unit[]>('/units')
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
