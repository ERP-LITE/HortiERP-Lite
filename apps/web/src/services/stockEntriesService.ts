import { api } from './api'
import type { PaginatedResult, StockEntry, StockEntryAttachment, StockEntrySummary } from '@/types'

export interface StockEntryItemInput {
  productId: string
  quantity: number
  unitCost?: number
}

export interface StockEntryInput {
  supplierName?: string
  entryDate?: string
  notes?: string
  invoiceNumber?: string
  invoiceSeries?: string
  invoiceAccessKey?: string
  invoiceIssuedAt?: string
  invoiceTotal?: number
  items: StockEntryItemInput[]
}

export interface UpdateStockEntryDetailsInput {
  supplierName: string | null
  notes: string | null
  invoiceNumber: string | null
  invoiceSeries: string | null
  invoiceAccessKey: string | null
  invoiceIssuedAt: string | null
  invoiceTotal: number | null
}

export interface ListStockEntriesParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page: number
  pageSize: number
  search?: string
  from?: string
  to?: string
}

export async function listStockEntries(params: ListStockEntriesParams) {
  const { data } = await api.get<PaginatedResult<StockEntrySummary>>('/stock-entries', { params })
  return data
}

export async function createStockEntry(payload: StockEntryInput) {
  const { data } = await api.post<StockEntry>('/stock-entries', payload)
  return data
}

export async function getStockEntry(id: string) {
  const { data } = await api.get<StockEntry>(`/stock-entries/${id}`)
  return data
}

export async function updateStockEntryDetails(id: string, payload: UpdateStockEntryDetailsInput) {
  const { data } = await api.patch<StockEntry>(`/stock-entries/${id}`, payload)
  return data
}

export async function uploadStockEntryAttachment(entryId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<StockEntryAttachment>(`/stock-entries/${entryId}/attachments`, formData)
  return data
}

export async function getStockEntryAttachmentBlob(entryId: string, attachmentId: string, preview = false) {
  const { data } = await api.get<Blob>(`/stock-entries/${entryId}/attachments/${attachmentId}`, {
    params: preview ? { preview: true } : undefined,
    responseType: 'blob',
  })
  return data
}

export async function deleteStockEntryAttachment(entryId: string, attachmentId: string) {
  await api.delete(`/stock-entries/${entryId}/attachments/${attachmentId}`)
}
