import { api } from './api'

export type AlertProductStatus = 'sem_estoque' | 'abaixo_do_minimo'

export interface AlertProduct {
  id: string
  name: string
  currentStock: string
  minStock: string
  unitAbbreviation: string
  status: AlertProductStatus
}

export interface OperationalAlerts {
  generatedAt: string
  total: number
  outOfStockCount: number
  lowStockCount: number
  withoutMinStockCount: number
  lossesToday: { count: number; value: number }
  products: AlertProduct[]
}

export async function fetchOperationalAlerts() {
  const { data } = await api.get<OperationalAlerts>('/notifications')
  return data
}
