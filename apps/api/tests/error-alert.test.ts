import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { db } from './db.js'
import { companies, systemLogs } from '../src/db/schema/index.js'
import { describeErrorSummary, summarizeRecentErrors } from '../src/modules/logs/error-alert.service.js'
import { setupTestApp, truncateAsOwner } from './helpers.js'

setupTestApp()

interface LinhaDeLog {
  method?: string
  path?: string
  statusCode?: number
  level?: string
  errorMessage?: string | null
  minutosAtras?: number
  companyId?: string
}

async function registrar(linhas: LinhaDeLog[]) {
  await db.insert(systemLogs).values(
    linhas.map((linha) => ({
      companyId: linha.companyId,
      method: linha.method ?? 'GET',
      path: linha.path ?? '/api/products',
      statusCode: linha.statusCode ?? 500,
      durationMs: 10,
      level: linha.level ?? 'error',
      errorMessage: linha.errorMessage ?? 'Erro interno do servidor',
      createdAt: new Date(Date.now() - (linha.minutosAtras ?? 0) * 60_000),
    })),
  )
}

describe('alerta de erro de servidor', () => {
  test('conta só os erros dentro da janela', async () => {
    await truncateAsOwner('system_logs')
    await registrar([{ minutosAtras: 1 }, { minutosAtras: 5 }, { minutosAtras: 40 }])

    const resumo = await resumoDaJanela()

    assert.equal(resumo.total, 2)
  })

  test('ignora requisição que deu certo e aviso de 4xx', async () => {
    await truncateAsOwner('system_logs')
    await registrar([
      { level: 'info', statusCode: 200 },
      { level: 'warning', statusCode: 422 },
      { level: 'error', statusCode: 500 },
    ])

    const resumo = await resumoDaJanela()

    assert.equal(resumo.total, 1)
    assert.equal(resumo.grupos[0].statusCode, 500)
  })

  test('agrupa por rota e ordena pelo que mais falha', async () => {
    await truncateAsOwner('system_logs')
    await registrar([
      { path: '/api/products', method: 'GET' },
      { path: '/api/products', method: 'GET' },
      { path: '/api/products', method: 'GET' },
      { path: '/api/losses', method: 'POST' },
    ])

    const resumo = await resumoDaJanela()

    assert.equal(resumo.total, 4)
    assert.equal(resumo.grupos.length, 2)
    assert.equal(resumo.grupos[0].path, '/api/products')
    assert.equal(resumo.grupos[0].total, 3)
  })

  // O alerta é sinal do sistema todo: se ele enxergasse só uma empresa, o erro que está derrubando
  // a empresa vizinha passaria em silêncio.
  test('enxerga erro de qualquer empresa e também o que aconteceu sem sessão', async () => {
    await truncateAsOwner('companies CASCADE')
    await truncateAsOwner('system_logs')
    const [uma] = await db.insert(companies).values({ name: 'Empresa Uma' }).returning({ id: companies.id })
    const [outra] = await db.insert(companies).values({ name: 'Empresa Outra' }).returning({ id: companies.id })

    await registrar([
      { companyId: uma.id, path: '/api/products' },
      { companyId: outra.id, path: '/api/losses' },
      { path: '/api/auth/login' },
    ])

    const resumo = await resumoDaJanela()

    assert.equal(resumo.total, 3)
  })

  test('o texto do alerta diz rota, contagem e mensagem', async () => {
    await truncateAsOwner('system_logs')
    await registrar([{ path: '/api/stock/adjust', method: 'POST', errorMessage: 'deadlock detected' }])

    const texto = describeErrorSummary(await resumoDaJanela())

    assert.match(texto, /1x POST \/api\/stock\/adjust -> 500/)
    assert.match(texto, /deadlock detected/)
  })

  test('janela sem erro nenhum não vira alerta', async () => {
    await truncateAsOwner('system_logs')

    const resumo = await resumoDaJanela()

    assert.equal(resumo.total, 0)
    assert.equal(describeErrorSummary(resumo), 'Nenhum erro de servidor na janela.')
  })
})

/** Janela de 16 minutos: o padrão de produção (15 min de intervalo mais a folga de 1 min). */
function resumoDaJanela() {
  return summarizeRecentErrors(16 * 60)
}
