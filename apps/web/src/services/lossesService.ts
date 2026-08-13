import { api } from './api'
import { fetchAllPages } from './paginatedOptions'
import type { Loss, LossReason, PaginatedResult } from '@/types'

export interface LossInput {
  productId: string
  quantity: number
  reason: LossReason
  notes?: string
  lossDate?: string
}

export interface ListLossesParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page: number
  pageSize: number
  search?: string
  productId?: string
  reason?: LossReason
  from?: string
  to?: string
}

export async function listLosses(params: ListLossesParams) {
  const { data } = await api.get<PaginatedResult<Loss>>('/losses', { params })
  return data
}

export function listAllLosses(params: Omit<ListLossesParams, 'page' | 'pageSize'> = {}) {
  return fetchAllPages((page, pageSize) => listLosses({ ...params, page, pageSize }))
}

export async function createLoss(payload: LossInput) {
  const { data } = await api.post<Loss>('/losses', payload)
  return data
}
