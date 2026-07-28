import { api } from './api'
import type { DashboardSummary } from '@/types'

export interface DashboardSummaryParams {
  from?: string
  to?: string
}

export async function fetchDashboardSummary(params: DashboardSummaryParams) {
  const { data } = await api.get<DashboardSummary>('/dashboard/summary', { params })
  return data
}
