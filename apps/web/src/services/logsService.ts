import { api } from './api'
import type { PaginatedResult, SystemLog, SystemLogLevel, SystemLogMethod } from '@/types'

export interface ListLogsParams {
  page: number
  pageSize: number
  search?: string
  method?: SystemLogMethod
  level?: SystemLogLevel
  companyId?: string
  from?: string
  to?: string
}

export async function listTechnicalLogs(params: ListLogsParams) {
  const { data } = await api.get<PaginatedResult<SystemLog>>('/logs/technical', { params })
  return data
}

export async function listActivityLogs(params: ListLogsParams) {
  const { data } = await api.get<PaginatedResult<SystemLog>>('/logs/activity', { params })
  return data
}
