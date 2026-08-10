import http from 'k6/http'
import { check, sleep } from 'k6'
import exec from 'k6/execution'

// Este cenário GRAVA dados: cria entradas de mercadoria, anexa arquivos e
// registra perdas. Ele existe para exercitar justamente os caminhos onde a
// concorrência importa — atualização atômica de estoque e o upload de anexos,
// que o read-flow não toca. Use só contra base descartável.

const baseUrl = (__ENV.BASE_URL || 'http://host.docker.internal:3333').replace(/\/$/, '')
const profile = __ENV.LOAD_PROFILE || 'baseline'

// Perfis menores que os de leitura: cada iteração aqui abre transação e mexe
// em disco, então subir a 80 usuários testaria o hardware, não o sistema.
const profiles = {
  smoke: [
    { duration: '10s', target: 2 },
    { duration: '20s', target: 3 },
    { duration: '10s', target: 0 },
  ],
  baseline: [
    { duration: '30s', target: 3 },
    { duration: '1m', target: 8 },
    { duration: '1m', target: 15 },
    { duration: '30s', target: 0 },
  ],
  stress: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 15 },
    { duration: '2m', target: 30 },
    { duration: '30s', target: 0 },
  ],
}

if (!profiles[profile]) throw new Error(`LOAD_PROFILE inválido: ${profile}. Use smoke, baseline ou stress.`)

export const options = {
  stages: profiles[profile],
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    // Limites mais folgados que os de leitura: escrita passa por transação,
    // lock de linha e, no caso de anexo, gravação em disco.
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
  userAgent: 'HortiERP-Load-Test/1.0',
}

const headers = (token) => ({
  Cookie: `token=${token}`,
  'User-Agent': 'HortiERP-Load-Test/1.0',
  'Content-Type': 'application/json',
})

export function setup() {
  if (__ENV.ALLOW_WRITE_LOAD_TEST !== 'true') {
    throw new Error(
      'Este cenário grava dados. Confirme com ALLOW_WRITE_LOAD_TEST=true e aponte para uma base descartável.',
    )
  }

  const login = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({
      email: __ENV.LOAD_TEST_EMAIL || 'operador@hortierp.com',
      password: __ENV.LOAD_TEST_PASSWORD || 'operador123',
    }),
    {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'HortiERP-Load-Test/1.0' },
      tags: { name: 'POST /api/auth/login [setup]' },
    },
  )

  const authenticated = check(login, {
    'login do teste de carga funcionou': (result) => result.status === 200 && Boolean(result.cookies.token?.[0]?.value),
  })
  if (!authenticated) {
    throw new Error(`Login falhou com HTTP ${login.status}. Confira as credenciais de homologação.`)
  }

  const token = login.cookies.token[0].value
  const stock = http.get(`${baseUrl}/api/stock?page=1&pageSize=30`, {
    headers: headers(token),
    tags: { name: 'GET /api/stock [setup]' },
  })

  const productIds = (stock.json('data') || []).map((product) => product.id)
  if (productIds.length === 0) {
    throw new Error('Nenhum produto encontrado. Rode o seed antes do teste de escrita.')
  }

  return { token, productIds }
}

function pickProduct(productIds) {
  return productIds[Math.floor(Math.random() * productIds.length)]
}

// PNG mínimo: a validação de assinatura da API lê só os primeiros bytes, então
// o cabeçalho basta para o arquivo ser aceito como imagem legítima.
const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer

function createEntry(data) {
  const response = http.post(
    `${baseUrl}/api/stock-entries`,
    JSON.stringify({
      supplierName: `Fornecedor carga ${exec.vu.idInTest}`,
      items: [{ productId: pickProduct(data.productIds), quantity: 1 + Math.floor(Math.random() * 5) }],
    }),
    { headers: headers(data.token), tags: { name: 'POST /api/stock-entries' }, timeout: '15s' },
  )

  check(response, { 'POST /api/stock-entries respondeu 201': (result) => result.status === 201 })
  return response.status === 201 ? response.json('id') : null
}

function uploadAttachment(data, entryId) {
  const response = http.post(
    `${baseUrl}/api/stock-entries/${entryId}/attachments`,
    { file: http.file(pngHeader, 'danfe-carga.png', 'image/png') },
    {
      headers: { Cookie: `token=${data.token}`, 'User-Agent': 'HortiERP-Load-Test/1.0' },
      tags: { name: 'POST /api/stock-entries/:id/attachments' },
      timeout: '20s',
    },
  )

  check(response, {
    // 422 é resposta correta quando a entrada já atingiu 3 anexos — o limite
    // sendo respeitado sob concorrência é justamente o que se quer observar.
    'POST attachments respondeu 201 ou 422': (result) => result.status === 201 || result.status === 422,
  })

  if (response.status === 429) {
    exec.test.abort(
      'Upload recebeu 429: o rate limit da rota está ativo. Este cenário exige NODE_ENV diferente de production.',
    )
  }
}

function registerLoss(data) {
  const response = http.post(
    `${baseUrl}/api/losses`,
    JSON.stringify({ productId: pickProduct(data.productIds), quantity: 1, reason: 'avariado' }),
    { headers: headers(data.token), tags: { name: 'POST /api/losses' }, timeout: '15s' },
  )

  check(response, {
    // 422 significa saldo insuficiente: é a guarda atômica de estoque
    // funcionando, não uma falha do sistema sob carga.
    'POST /api/losses respondeu 201 ou 422': (result) => result.status === 201 || result.status === 422,
  })
}

export default function (data) {
  const choice = Math.random()

  if (choice < 0.55) {
    const entryId = createEntry(data)
    // Metade das entradas recebe anexo, imitando o fluxo real de lançar a
    // mercadoria e em seguida anexar a nota.
    if (entryId && Math.random() < 0.5) uploadAttachment(data, entryId)
  } else if (choice < 0.8) {
    registerLoss(data)
  } else {
    const response = http.get(`${baseUrl}/api/stock-entries?page=1&pageSize=15`, {
      headers: headers(data.token),
      tags: { name: 'GET /api/stock-entries' },
      timeout: '10s',
    })
    check(response, { 'GET /api/stock-entries respondeu 200': (result) => result.status === 200 })
  }

  sleep(0.5 + Math.random())
}
