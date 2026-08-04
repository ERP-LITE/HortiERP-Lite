import { api } from './api'
import type { Loss, PaginatedResult, StockEntry } from '@/types'

export interface StockByCategoryRow {
  categoryId: string
  categoryName: string
  productCount: number
  totalStock: number
}

export interface LossesReport extends PaginatedResult<Loss> {
  byReason: { reason: string; quantity: number; occurrences: number }[]
}

export interface DateRangeParams {
  from?: string
  to?: string
  search?: string
  page?: number
  pageSize?: number
}

export async function fetchStockByCategoryReport() {
  const { data } = await api.get<StockByCategoryRow[]>('/reports/stock-by-category')
  return data
}

export async function fetchLossesReport(params: DateRangeParams = {}) {
  const { data } = await api.get<LossesReport>('/reports/losses', { params })
  return data
}

export async function fetchStockEntriesReport(params: DateRangeParams = {}) {
  const { data } = await api.get<PaginatedResult<StockEntry>>('/reports/stock-entries', { params })
  return data
}
