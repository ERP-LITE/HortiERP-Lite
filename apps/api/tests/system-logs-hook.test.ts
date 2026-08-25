import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { db } from './db.js'
import { systemLogs } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp, truncateAsOwner } from './helpers.js'

// Único arquivo que sobe o app com o hook de log ligado: sem isso, nada que dependa
// dele aparece na suíte — foi exatamente o ponto cego que deixou `/api/health`
// gravando log de monitoramento em `system_logs`.
const ctx = setupTestApp({ systemLogs: true })

/**
 * O hook roda em `onResponse`, depois da resposta já ter sido devolvida, então o
 * insert pode não ter concluído quando o `inject` retorna. Espera a linha esperada
 * aparecer em vez de dormir um tempo fixo.
 */
async function waitForLoggedPath(path: string, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const rows = await db.select({ path: systemLogs.path }).from(systemLogs)
    if (rows.some((row) => row.path === path)) return rows.map((row) => row.path)
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`A rota ${path} não foi registrada em system_logs dentro do timeout`)
}

describe('hook de log de requisições', () => {
  it('não registra healthcheck em nenhum dos dois caminhos', async () => {
    await truncateAsOwner('system_logs')
    const tenant = await createTenant('log-health')
    const cookie = authCookie(ctx.app, tenant.admin)

    for (const url of ['/health', '/api/health']) {
      const response = await ctx.app.inject({ method: 'GET', url })
      assert.equal(response.statusCode, 200, `${url} deve responder ok`)
    }

    // Uma rota normal serve de marcador: quando ela aparece, o hook já processou
    // tudo o que veio antes dela.
    await ctx.app.inject({ method: 'GET', url: '/api/products', headers: { cookie } })
    const paths = await waitForLoggedPath('/api/products')

    assert.deepEqual(
      paths.filter((path) => path.includes('health')),
      [],
      'healthcheck de monitoramento não pode poluir o log',
    )
  })

  it('não registra as próprias telas de consulta de log', async () => {
    await truncateAsOwner('system_logs')
    const tenant = await createTenant('log-logs')
    const cookie = authCookie(ctx.app, tenant.admin)

    await ctx.app.inject({ method: 'GET', url: '/api/logs/activity', headers: { cookie } })
    await ctx.app.inject({ method: 'GET', url: '/api/products', headers: { cookie } })
    const paths = await waitForLoggedPath('/api/products')

    assert.deepEqual(paths.filter((path) => path.includes('/logs/')), [])
  })
})
