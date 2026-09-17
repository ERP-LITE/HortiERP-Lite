import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'
import Fastify from 'fastify'

/**
 * O limite de tentativas por IP e o IP gravado em `system_logs` valem o que `request.ip` valer, e
 * `request.ip` é decidido inteiramente pelo `trustProxy`. Errar esse valor não quebra nada: a API
 * sobe, responde e some com a proteção. Foi o que aconteceu no Fastify 5.12, que passou a recusar
 * todos os peers quando o `trustProxy` é contagem de saltos (correção do GHSA-3m5p-2c4r-xxw2) e
 * transformou o antigo `TRUST_PROXY=1` em `false` calado.
 */

const COMPOSE_DE_PRODUCAO = fileURLToPath(new URL('../../../docker-compose.production.yml', import.meta.url))

const IP_DO_GATEWAY = '172.18.0.9'
const IP_DO_CLIENTE = '1.2.3.4'

function trustProxyDeProducao() {
  const compose = readFileSync(COMPOSE_DE_PRODUCAO, 'utf8')
  const encontrado = compose.match(/^\s*TRUST_PROXY:\s*"?([^"\n]+)"?\s*$/m)
  assert.ok(encontrado, 'TRUST_PROXY não encontrado no docker-compose.production.yml')
  return encontrado[1].trim()
}

async function ipVisto(trustProxy: string | number | boolean, remoteAddress = IP_DO_GATEWAY) {
  const app = Fastify({ trustProxy, logger: false })
  app.get('/', async (request) => ({ ip: request.ip }))
  await app.ready()

  try {
    const resposta = await app.inject({
      method: 'GET',
      url: '/',
      headers: { 'x-forwarded-for': IP_DO_CLIENTE },
      remoteAddress,
    })
    return resposta.json<{ ip: string }>().ip
  } finally {
    await app.close()
  }
}

describe('confiança no proxy', () => {
  test('o valor que produção usa enxerga o cliente por trás do gateway', async () => {
    assert.equal(await ipVisto(trustProxyDeProducao()), IP_DO_CLIENTE)
  })

  test('o valor de produção ignora o cabeçalho de quem chega direto, sem passar pelo gateway', async () => {
    const forasteiro = '203.0.113.7'
    assert.equal(await ipVisto(trustProxyDeProducao(), forasteiro), forasteiro)
  })

  test('contagem de saltos não vale mais: o cliente some atrás do gateway', async () => {
    assert.equal(await ipVisto(1), IP_DO_GATEWAY)
  })

  test('sem proxy declarado, todo cliente chega como o gateway', async () => {
    assert.equal(await ipVisto(false), IP_DO_GATEWAY)
  })

  test('`true` deixaria quem chega direto escolher o próprio IP', async () => {
    assert.equal(await ipVisto(true, '203.0.113.7'), IP_DO_CLIENTE)
  })
})
