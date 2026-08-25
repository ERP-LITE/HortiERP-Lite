import { AppError } from '../../shared/errors/AppError.js'

export interface CepAddress {
  street: string
  complement: string
  district: string
  city: string
  state: string
}

interface CepProvider {
  url: (cep: string) => string
  parse: (payload: Record<string, unknown>) => CepAddress | null
}

const providers: CepProvider[] = [
  {
    url: (cep) => `https://brasilapi.com.br/api/cep/v2/${cep}`,
    parse: (data) => data.city && data.state
      ? { street: String(data.street || ''), complement: '', district: String(data.neighborhood || ''), city: String(data.city), state: String(data.state) }
      : null,
  },
  {
    url: (cep) => `https://viacep.com.br/ws/${cep}/json/`,
    parse: (data) => !data.erro && data.localidade && data.uf
      ? { street: String(data.logradouro || ''), complement: String(data.complemento || ''), district: String(data.bairro || ''), city: String(data.localidade), state: String(data.uf) }
      : null,
  },
  {
    url: (cep) => `https://opencep.com/v1/${cep}.json`,
    parse: (data) => data.localidade && data.uf
      ? { street: String(data.logradouro || ''), complement: String(data.complemento || ''), district: String(data.bairro || ''), city: String(data.localidade), state: String(data.uf) }
      : null,
  },
]

async function queryProvider(provider: CepProvider, cep: string) {
  const response = await fetch(provider.url(cep), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(4_000),
  })
  if (!response.ok && response.status !== 404) throw new Error(`Provedor respondeu ${response.status}`)
  if (response.status === 404) return null
  return provider.parse(await response.json() as Record<string, unknown>)
}

export async function findAddressByCep(rawCep: string): Promise<CepAddress> {
  const cep = rawCep.replace(/\D/g, '')
  if (cep.length !== 8) throw new AppError('CEP inválido', 422, 'VALIDATION_ERROR')

  let algumProvedorRespondeu = false
  for (const provider of providers) {
    try {
      const address = await queryProvider(provider, cep)
      algumProvedorRespondeu = true
      if (address) return address
    } catch {
    }
  }

  if (!algumProvedorRespondeu) {
    throw new AppError(
      'Não foi possível consultar o CEP agora. Preencha o endereço à mão.',
      503,
      'CEP_LOOKUP_UNAVAILABLE',
    )
  }

  throw AppError.notFound('CEP não encontrado nos serviços disponíveis')
}
