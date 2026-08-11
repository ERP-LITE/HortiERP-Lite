import { api, getApiErrorMessage } from './api'

export interface CepAddress {
  street: string
  complement: string
  district: string
  city: string
  state: string
}

export async function findAddressByCep(rawCep: string): Promise<CepAddress> {
  const cep = rawCep.replace(/\D/g, '')
  if (cep.length !== 8) throw new Error('CEP inválido')

  try {
    const { data } = await api.get<CepAddress>(`/address/cep/${cep}`)
    return data
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Não foi possível consultar o CEP'))
  }
}
