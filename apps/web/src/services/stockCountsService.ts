import { api } from './api'
import type { PaginatedResult, StockCount, StockCountItem, StockCountStatus, StockCountSummary } from '@/types'

export interface StartStockCountInput {
  categoryId?: string
  notes?: string
}

export interface ListStockCountsParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page: number
  pageSize: number
  status?: StockCountStatus
}

export type SituacaoDoItem = 'todos' | 'pendentes' | 'contados' | 'divergentes'

export interface ListStockCountItemsParams {
  page: number
  pageSize: number
  search?: string
  situacao?: SituacaoDoItem
}

export async function listStockCounts(params: ListStockCountsParams) {
  const { data } = await api.get<PaginatedResult<StockCountSummary>>('/stock-counts', { params })
  return data
}

/** Devolve `null` quando não existe contagem em aberto: é a resposta normal, não um erro. */
export async function getOpenStockCount() {
  const { data } = await api.get<StockCount | null>('/stock-counts/open')
  return data
}

export async function getStockCount(id: string) {
  const { data } = await api.get<StockCount>(`/stock-counts/${id}`)
  return data
}

export async function listStockCountItems(id: string, params: ListStockCountItemsParams) {
  const { data } = await api.get<PaginatedResult<StockCountItem>>(`/stock-counts/${id}/items`, { params })
  return data
}

export async function startStockCount(payload: StartStockCountInput) {
  const { data } = await api.post<StockCount>('/stock-counts', payload)
  return data
}

/** `null` apaga o lançamento e devolve o produto para a fila de pendentes. */
export async function countStockCountItem(id: string, productId: string, countedQuantity: number | null) {
  const { data } = await api.patch<{ productId: string; countedQuantity: string | null; countedAt: string | null }>(
    `/stock-counts/${id}/items/${productId}`,
    { countedQuantity },
  )
  return data
}

export async function reviewStockCount(id: string) {
  const { data } = await api.post<StockCount>(`/stock-counts/${id}/review`)
  return data
}

export async function reopenStockCount(id: string) {
  const { data } = await api.post<StockCount>(`/stock-counts/${id}/reopen`)
  return data
}

export async function finishStockCount(id: string) {
  const { data } = await api.post<StockCount>(`/stock-counts/${id}/finish`)
  return data
}

export async function cancelStockCount(id: string, cancelReason: string) {
  const { data } = await api.post<StockCount>(`/stock-counts/${id}/cancel`, { cancelReason })
  return data
}
