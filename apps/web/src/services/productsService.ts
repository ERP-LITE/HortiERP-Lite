import { api } from './api'
import type { PaginatedResult, Product } from '@/types'

export interface ProductInput {
  categoryId: string
  unitId: string
  name: string
  sku?: string
  barcode?: string
  costPrice?: number
  salePrice?: number
  minStock: number
  active: boolean
}

export interface ListProductsParams {
  page: number
  pageSize: number
  search?: string
  categoryId?: string
  active?: boolean
}

export async function listProducts(params: ListProductsParams) {
  const { data } = await api.get<PaginatedResult<Product>>('/products', { params })
  return data
}

export async function createProduct(payload: ProductInput) {
  const { data } = await api.post<Product>('/products', payload)
  return data
}

export async function updateProduct(id: string, payload: Partial<ProductInput>) {
  const { data } = await api.put<Product>(`/products/${id}`, payload)
  return data
}

export async function deleteProduct(id: string) {
  await api.delete(`/products/${id}`)
}

export async function deleteProducts(ids: string[]) {
  const { data } = await api.post<{ deleted: number }>('/products/bulk-delete', { ids })
  return data
}
