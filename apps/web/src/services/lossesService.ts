import { api } from './api'
import type { Loss, LossReason, PaginatedResult } from '@/types'

export interface LossInput {
  productId: string
  quantity: number
  reason: LossReason
  notes?: string
  lossDate?: string
}

export interface ListLossesParams {
  page: number
  pageSize: number
  productId?: string
  reason?: LossReason
  from?: string
  to?: string
}

export async function listLosses(params: ListLossesParams) {
  const { data } = await api.get<PaginatedResult<Loss>>('/losses', { params })
  return data
}

export async function createLoss(payload: LossInput) {
  const { data } = await api.post<Loss>('/losses', payload)
  return data
}
