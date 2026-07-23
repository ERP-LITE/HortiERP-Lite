import { api } from './api'
import type { Loss, LossReason } from '@/types'

export interface LossInput {
  productId: string
  quantity: number
  reason: LossReason
  notes?: string
  lossDate?: string
}

export async function listLosses() {
  const { data } = await api.get<Loss[]>('/losses')
  return data
}

export async function createLoss(payload: LossInput) {
  const { data } = await api.post<Loss>('/losses', payload)
  return data
}
