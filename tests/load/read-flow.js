import http from 'k6/http'
import { check, sleep } from 'k6'
import exec from 'k6/execution'

const baseUrl = (__ENV.BASE_URL || 'http://host.docker.internal:3333').replace(/\/$/, '')
const profile = __ENV.LOAD_PROFILE || 'baseline'

const profiles = {
  smoke: [
    { duration: '10s', target: 2 },
    { duration: '20s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  baseline: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 15 },
    { duration: '1m', target: 30 },
    { duration: '30s', target: 0 },
  ],
  stress: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '2m', target: 60 },
    { duration: '1m', target: 80 },
    { duration: '30s', target: 0 },
  ],
}

if (!profiles[profile]) throw new Error(`LOAD_PROFILE inválido: ${profile}. Use smoke, baseline ou stress.`)

export const options = {
  stages: profiles[profile],
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750', 'p(99)<1500'],
  },
  userAgent: 'HortiERP-Load-Test/1.0',
}

export function setup() {
  const response = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({
      email: __ENV.LOAD_TEST_EMAIL || 'operador@hortierp.com',
      password: __ENV.LOAD_TEST_PASSWORD || 'operador123',
      turnstileToken: __ENV.LOAD_TEST_TURNSTILE_TOKEN || 'load-test',
    }),
    {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'HortiERP-Load-Test/1.0' },
      tags: { name: 'POST /api/auth/login [setup]' },
    },
  )

  const authenticated = check(response, {
    'login do teste de carga funcionou': (result) => result.status === 200 && Boolean(result.cookies.token?.[0]?.value),
  })
  if (!authenticated) {
    throw new Error(`Login falhou com HTTP ${response.status}. Confira credenciais e Turnstile de homologação.`)
  }

  return { token: response.cookies.token[0].value }
}

const routes = [
  { max: 0.10, name: 'GET /api/auth/me', path: '/api/auth/me' },
  { max: 0.30, name: 'GET /api/dashboard/summary', path: '/api/dashboard/summary' },
  { max: 0.55, name: 'GET /api/stock', path: '/api/stock?page=1&pageSize=30' },
  { max: 0.75, name: 'GET /api/stock-entries', path: '/api/stock-entries?page=1&pageSize=15' },
  { max: 0.90, name: 'GET /api/stock/movements', path: '/api/stock/movements?page=1&pageSize=15' },
  { max: 1, name: 'GET /api/reports/stock-by-category', path: '/api/reports/stock-by-category' },
]

export default function (data) {
  const choice = Math.random()
  const route = routes.find(({ max }) => choice <= max) || routes[routes.length - 1]
  const response = http.get(`${baseUrl}${route.path}`, {
    headers: { Cookie: `token=${data.token}`, 'User-Agent': 'HortiERP-Load-Test/1.0' },
    tags: { name: route.name },
    timeout: '10s',
  })

  check(response, {
    [`${route.name} respondeu 200`]: (result) => result.status === 200,
  })

  if (response.status === 401) {
    exec.test.abort('A sessão usada no teste foi invalidada')
  }

  sleep(0.5 + Math.random())
}
