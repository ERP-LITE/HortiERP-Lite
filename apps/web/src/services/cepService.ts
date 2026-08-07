export interface CepAddress {
  street: string
  complement: string
  district: string
  city: string
  state: string
}

interface CepProvider {
  name: string
  url: (cep: string) => string
  parse: (payload: Record<string, unknown>) => CepAddress | null
}

const providers: CepProvider[] = [
  {
    name: 'BrasilAPI',
    url: (cep) => `https://brasilapi.com.br/api/cep/v2/${cep}`,
    parse: (data) => data.city && data.state
      ? { street: String(data.street || ''), complement: '', district: String(data.neighborhood || ''), city: String(data.city), state: String(data.state) }
      : null,
  },
  {
    name: 'ViaCEP',
    url: (cep) => `https://viacep.com.br/ws/${cep}/json/`,
    parse: (data) => !data.erro && data.localidade && data.uf
      ? { street: String(data.logradouro || ''), complement: String(data.complemento || ''), district: String(data.bairro || ''), city: String(data.localidade), state: String(data.uf) }
      : null,
  },
  {
    name: 'OpenCEP',
    url: (cep) => `https://opencep.com/v1/${cep}.json`,
    parse: (data) => data.localidade && data.uf
      ? { street: String(data.logradouro || ''), complement: String(data.complemento || ''), district: String(data.bairro || ''), city: String(data.localidade), state: String(data.uf) }
      : null,
  },
]

async function fetchWithTimeout(url: string, timeoutMs = 3500) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function findAddressByCep(rawCep: string): Promise<CepAddress> {
  const cep = rawCep.replace(/\D/g, '')
  if (cep.length !== 8) throw new Error('CEP inválido')

  for (const provider of providers) {
    try {
      const response = await fetchWithTimeout(provider.url(cep))
      if (!response.ok) continue
      const address = provider.parse(await response.json() as Record<string, unknown>)
      if (address) return address
    } catch {
      // O próximo provedor assume automaticamente em falhas de rede/timeout.
    }
  }

  throw new Error('CEP não encontrado nos serviços disponíveis')
}
