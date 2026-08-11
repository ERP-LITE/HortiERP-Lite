import { api } from './api'
import type { PaginatedResult } from '@/types'

export type BillingStatus = 'pending' | 'paid' | 'overdue'

export interface Billing {
  id: string
  companyId: string
  companyName: string
  referenceMonth: string
  dueDate: string
  amount: string
  paidAmount: string | null
  paidAt: string | null
  status: BillingStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface BillingInput {
  companyId: string
  referenceMonth: string
  dueDate: string
  amount: number
  paidAmount: number | null
  paidAt: string | null
  notes: string | null
}

export interface ListBillingsParams {
  page: number
  pageSize: number
  search?: string
  from?: string
  to?: string
  status?: BillingStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export async function listBillings(params: ListBillingsParams) {
  const { data } = await api.get<PaginatedResult<Billing>>('/billings', { params })
  return data
}

export async function createBilling(payload: BillingInput) {
  const { data } = await api.post<Billing>('/billings', payload)
  return data
}

export async function updateBilling(id: string, payload: BillingInput) {
  const { data } = await api.put<Billing>(`/billings/${id}`, payload)
  return data
}

export async function deleteBilling(id: string) {
  await api.delete(`/billings/${id}`)
}
