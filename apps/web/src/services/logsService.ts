import { api } from './api'
import { fetchAllPages } from './paginatedOptions'
import type {
  ActivityAction,
  ActivityEntity,
  ActivityLog,
  PaginatedResult,
  SystemLog,
  SystemLogLevel,
  SystemLogMethod,
} from '@/types'

export interface ListLogsParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
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

export interface ListActivityParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page: number
  pageSize: number
  search?: string
  action?: ActivityAction
  entity?: ActivityEntity
  from?: string
  to?: string
}

export async function listActivityLogs(params: ListActivityParams) {
  const { data } = await api.get<PaginatedResult<ActivityLog>>('/logs/activity', { params })
  return data
}

export function listAllActivityLogs(params: Omit<ListActivityParams, 'page' | 'pageSize'> = {}) {
  return fetchAllPages((page, pageSize) => listActivityLogs({ ...params, page, pageSize }))
}
