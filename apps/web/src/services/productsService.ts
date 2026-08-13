import { api } from './api'
import type { PaginatedResult, Product } from '@/types'
import { fetchAllPages } from './paginatedOptions'

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
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export async function listProducts(params: ListProductsParams) {
  const { data } = await api.get<PaginatedResult<Product>>('/products', { params })
  return data
}

export function listAllProducts(params: Omit<ListProductsParams, 'page' | 'pageSize'> = {}) {
  return fetchAllPages((page, pageSize) => listProducts({ ...params, page, pageSize }))
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

export interface ImportProductRow {
  line: number
  name: string
  categoryName: string
  unitName: string
  sku?: string
  barcode?: string
  costPrice?: string
  salePrice?: string
  minStock?: string
  currentStock?: string
  active?: string
}

export interface ImportProductsResult {
  summary: {
    total: number
    valid: number
    invalid: number
    imported: number
    omittedErrors: number
    withInitialStock: number
    initialStockWithoutCost: number
    newCategories: string[]
    newUnits: string[]
  }
  errors: { line: number; name: string; errors: string[] }[]
}

export async function importProducts(payload: {
  rows: ImportProductRow[]
  dryRun?: boolean
  createMissingRefs?: boolean
}) {
  const { data } = await api.post<ImportProductsResult>('/products/import', payload)
  return data
}
