import { api } from './api'
import { fetchAllPages } from './paginatedOptions'
import type { MovementType, PaginatedResult, ProductWithRelations, StockMovement } from '@/types'

export interface ListCurrentStockParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page: number
  pageSize: number
  search?: string
  categoryId?: string
  lowStockOnly?: boolean
}

export async function listCurrentStock(params: ListCurrentStockParams) {
  const { data } = await api.get<PaginatedResult<ProductWithRelations>>('/stock', { params })
  return data
}

export interface ListStockMovementsParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page: number
  pageSize: number
  search?: string
  productId?: string
  type?: MovementType
  from?: string
  to?: string
}

export async function listStockMovements(params: ListStockMovementsParams) {
  const { data } = await api.get<PaginatedResult<StockMovement>>('/stock/movements', { params })
  return data
}

export function listAllCurrentStock(params: Omit<ListCurrentStockParams, 'page' | 'pageSize'> = {}) {
  return fetchAllPages((page, pageSize) => listCurrentStock({ ...params, page, pageSize }))
}

export function listAllStockMovements(params: Omit<ListStockMovementsParams, 'page' | 'pageSize'> = {}) {
  return fetchAllPages((page, pageSize) => listStockMovements({ ...params, page, pageSize }))
}

export interface AdjustStockItem {
  productId: string
  quantity: number
}

export interface AdjustStockPayload {
  notes: string
  items: AdjustStockItem[]
}

export async function adjustStock(payload: AdjustStockPayload) {
  const { data } = await api.post<StockMovement[]>('/stock/adjust', payload)
  return data
}
