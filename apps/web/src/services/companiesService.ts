import { api } from './api'
import type { Company, PaginatedResult, SessionResponse } from '@/types'
import { fetchAllPages } from './paginatedOptions'

export interface CreateCompanyInput {
  name: string
  document?: string
  adminName: string
  adminEmail: string
  adminPassword: string
}

export interface UpdateCompanyInput {
  name?: string
  document?: string
}

export interface ListCompaniesParams {
  page: number
  pageSize: number
  search?: string
}

export async function listCompanies(params: ListCompaniesParams) {
  const { data } = await api.get<PaginatedResult<Company>>('/companies', { params })
  return data
}

export function listAllCompanies(params: Omit<ListCompaniesParams, 'page' | 'pageSize'> = {}) {
  return fetchAllPages((page, pageSize) => listCompanies({ ...params, page, pageSize }))
}

export async function createCompany(payload: CreateCompanyInput) {
  const { data } = await api.post<{ company: Company; admin: { id: string; name: string; email: string } }>(
    '/companies',
    payload,
  )
  return data
}

export async function updateCompany(id: string, payload: UpdateCompanyInput) {
  const { data } = await api.put<Company>(`/companies/${id}`, payload)
  return data
}

export async function setCompanyActive(id: string, active: boolean) {
  const { data } = await api.patch<Company>(`/companies/${id}/active`, { active })
  return data
}

export async function impersonateCompany(id: string) {
  const { data } = await api.post<SessionResponse>(`/companies/${id}/impersonate`)
  return data
}
