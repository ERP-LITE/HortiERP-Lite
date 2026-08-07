import { api } from './api'
import type { Company, PaginatedResult, SessionResponse } from '@/types'
import { fetchAllPages } from './paginatedOptions'

export interface CompanyDetailsInput {
  name: string
  legalName: string
  document: string
  stateRegistration?: string
  contactName: string
  contactEmail: string
  phone: string
  postalCode: string
  street: string
  addressNumber: string
  complement?: string
  district: string
  city: string
  state: string
}

export interface CreateCompanyInput extends CompanyDetailsInput {
  adminName: string
  adminEmail: string
  adminPassword: string
}

export type UpdateCompanyInput = CompanyDetailsInput

export interface ListCompaniesParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
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
