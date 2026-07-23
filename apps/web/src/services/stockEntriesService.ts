import { api } from './api'
import type { StockEntry } from '@/types'

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

export async function listStockEntries() {
  const { data } = await api.get<StockEntry[]>('/stock-entries')
  return data
}

export async function getStockEntry(id: string) {
  const { data } = await api.get<StockEntry>(`/stock-entries/${id}`)
  return data
}

export async function createStockEntry(payload: StockEntryInput) {
  const { data } = await api.post<StockEntry>('/stock-entries', payload)
  return data
}
