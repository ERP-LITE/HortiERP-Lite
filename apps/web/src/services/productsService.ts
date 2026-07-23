import { api } from './api'
import type { Product } from '@/types'

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

export async function listProducts() {
  const { data } = await api.get<Product[]>('/products')
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
