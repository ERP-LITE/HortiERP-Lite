import { api } from './api'
import type { CreateCompanyInput } from './companiesService'

export interface Plan {
  id: string
  name: string
  description: string | null
  monthlyAmount: string
  trialDays: number
}

export interface Subscription {
  status: 'teste' | 'ativa' | 'atrasada' | 'cancelada'
  /** Dias inteiros até o fim do teste. Zero é o último dia. `null` quando não está em teste. */
  diasRestantes: number | null
  trialEndsOn: string | null
  bloqueada: boolean
  planName: string | null
  monthlyAmount: string | null
}

export interface SignUpInput extends CreateCompanyInput {
  planId: string
  privacyAccepted: true
}

export async function listPlans() {
  const { data } = await api.get<Plan[]>('/plans')
  return data
}

export async function signUp(input: SignUpInput) {
  const { data } = await api.post<{
    company: { id: string; name: string }
    admin: { name: string; email: string }
    trialEndsOn: string | null
  }>('/signup', input)
  return data
}

export async function fetchSubscription() {
  const { data } = await api.get<Subscription>('/subscription')
  return data
}
