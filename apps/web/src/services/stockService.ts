import { api } from './api'
import type { MovementType, PaginatedResult, ProductWithRelations, StockMovement } from '@/types'

export interface ListCurrentStockParams {
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
