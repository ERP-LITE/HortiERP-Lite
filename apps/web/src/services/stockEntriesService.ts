import { api } from './api'
import type { PaginatedResult, StockEntry } from '@/types'

export interface StockEntryItemInput {
  productId: string
  quantity: number
  unitCost?: number
}

export interface StockEntryInput {
  supplierName?: string
  entryDate?: string
  notes?: string
  items: StockEntryItemInput[]
}

export interface ListStockEntriesParams {
  page: number
  pageSize: number
  search?: string
  from?: string
  to?: string
}

export async function listStockEntries(params: ListStockEntriesParams) {
  const { data } = await api.get<PaginatedResult<StockEntry>>('/stock-entries', { params })
  return data
}

export async function createStockEntry(payload: StockEntryInput) {
  const { data } = await api.post<StockEntry>('/stock-entries', payload)
  return data
}
