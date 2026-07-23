import { api } from './api'
import type { ProductWithRelations, StockMovement } from '@/types'

export async function listCurrentStock() {
  const { data } = await api.get<ProductWithRelations[]>('/stock')
  return data
}

export async function listStockMovements(productId?: string) {
  const { data } = await api.get<StockMovement[]>('/stock/movements', {
    params: productId ? { productId } : undefined,
  })
  return data
}
