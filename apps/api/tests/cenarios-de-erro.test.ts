import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { products, stockCounts, users } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp, type FixtureUser } from './helpers.js'
import { createLoss, createStockEntry } from './servicos.js'

const ctx = setupTestApp()

type Rota = { method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; url: string; payload?: unknown }

function pedir(rota: Rota, cookie?: string) {
  return ctx.app.inject({
    method: rota.method,
    url: rota.url,
    ...(cookie ? { headers: { cookie } } : {}),
    ...(rota.payload !== undefined ? { payload: rota.payload } : {}),
  })
}

/**
 * Varredura em vez de teste por rota: o que se quer provar é que **nenhuma** porta ficou destrancada,
 * e isso só vale se a lista crescer junto com as rotas. Rota nova sem entrada aqui é rota sem prova.
 */
const ROTAS_AUTENTICADAS: Rota[] = [
  { method: 'GET', url: '/api/auth/me' },
  { method: 'GET', url: '/api/products?page=1&pageSize=5' },
  { method: 'GET', url: '/api/categories?page=1&pageSize=5' },
  { method: 'GET', url: '/api/units?page=1&pageSize=5' },
  { method: 'GET', url: '/api/stock?page=1&pageSize=5' },
  { method: 'GET', url: '/api/stock/movements?page=1&pageSize=5' },
  { method: 'GET', url: '/api/stock-entries?page=1&pageSize=5' },
  { method: 'GET', url: '/api/losses?page=1&pageSize=5' },
  { method: 'GET', url: '/api/stock-counts?page=1&pageSize=5' },
  { method: 'GET', url: '/api/stock-counts/open' },
  { method: 'GET', url: '/api/dashboard/summary' },
  { method: 'GET', url: '/api/notifications' },
  { method: 'GET', url: '/api/reports/stock-by-category' },
  { method: 'GET', url: '/api/users?page=1&pageSize=5' },
  { method: 'GET', url: '/api/logs/activity?page=1&pageSize=5' },
  { method: 'GET', url: '/api/company' },
  { method: 'GET', url: '/api/subscription' },
  { method: 'GET', url: '/api/billings?page=1&pageSize=5' },
  { method: 'GET', url: '/api/companies?page=1&pageSize=5' },
  { method: 'POST', url: '/api/products', payload: {} },
  { method: 'POST', url: '/api/categories', payload: {} },
  { method: 'POST', url: '/api/units', payload: {} },
  { method: 'POST', url: '/api/losses', payload: {} },
  { method: 'POST', url: '/api/stock-entries', payload: {} },
  { method: 'POST', url: '/api/stock/adjust', payload: {} },
  { method: 'POST', url: '/api/stock-counts', payload: {} },
  { method: 'PATCH', url: '/api/auth/password', payload: {} },
]

describe('rotas cobertas exigem sessão', () => {
  for (const rota of ROTAS_AUTENTICADAS) {
    test(`${rota.method} ${rota.url.split('?')[0]} exige sessão`, async () => {
      const resposta = await pedir(rota)
      assert.equal(resposta.statusCode, 401, `${rota.method} ${rota.url} respondeu ${resposta.statusCode} sem cookie`)
    })
  }
})

describe('registro de outra empresa nunca é alcançado', () => {
  test('nenhuma busca por identificador atravessa a fronteira da empresa', async () => {
    const minha = await createTenant('erro-vizinho-a', '10')
    const vizinha = await createTenant('erro-vizinho-b', '10')

    const entradaVizinha = await createStockEntry(vizinha.companyId, vizinha.admin.id, {
      items: [{ productId: vizinha.productId, quantity: 1 }],
    })
    const perdaVizinha = await createLoss(vizinha.companyId, vizinha.admin.id, {
      productId: vizinha.productId,
      quantity: 1,
      reason: 'vencido',
    })
    const [contagemVizinha] = await db
      .insert(stockCounts)
      .values({ companyId: vizinha.companyId, createdBy: vizinha.admin.id })
      .returning({ id: stockCounts.id })

    const alvos: [string, string][] = [
      ['produto', `/api/products/${vizinha.productId}`],
      ['categoria', `/api/categories/${vizinha.categoryId}`],
      ['unidade', `/api/units/${vizinha.unitId}`],
      ['entrada', `/api/stock-entries/${entradaVizinha.id}`],
      ['perda', `/api/losses/${perdaVizinha.id}`],
      ['contagem', `/api/stock-counts/${contagemVizinha.id}`],
      ['itens da contagem', `/api/stock-counts/${contagemVizinha.id}/items?page=1&pageSize=5`],
      ['usuário', `/api/users/${vizinha.admin.id}`],
    ]

    for (const [nome, url] of alvos) {
      const resposta = await ctx.app.inject({ method: 'GET', url, headers: { cookie: authCookie(ctx.app, minha.admin) } })
      assert.equal(resposta.statusCode, 404, `${nome}: a empresa vizinha respondeu ${resposta.statusCode} em vez de 404`)
    }
  })

  test('escrever citando registro de outra empresa também é recusado', async () => {
    const minha = await createTenant('erro-escrita-a', '10')
    const vizinha = await createTenant('erro-escrita-b', '10')
    const cookie = authCookie(ctx.app, minha.admin)

    const escritas: [string, Rota][] = [
      ['perda no produto do vizinho', { method: 'POST', url: '/api/losses', payload: { productId: vizinha.productId, quantity: 1, reason: 'vencido' } }],
      ['entrada com produto do vizinho', { method: 'POST', url: '/api/stock-entries', payload: { items: [{ productId: vizinha.productId, quantity: 1 }] } }],
      ['ajuste no produto do vizinho', { method: 'POST', url: '/api/stock/adjust', payload: { notes: 'x', items: [{ productId: vizinha.productId, quantity: 5 }] } }],
      ['contagem na categoria do vizinho', { method: 'POST', url: '/api/stock-counts', payload: { categoryId: vizinha.categoryId } }],
    ]

    for (const [nome, rota] of escritas) {
      const resposta = await pedir(rota, cookie)
      assert.ok(
        resposta.statusCode >= 400 && resposta.statusCode < 500,
        `${nome}: respondeu ${resposta.statusCode}, ou seja aceitou escrever citando outra empresa`,
      )
    }

    const [produtoIntacto] = await db
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, vizinha.productId))
    assert.equal(produtoIntacto.currentStock, '10.000', 'o estoque do vizinho foi alterado')
  })
})

describe('papel insuficiente é barrado em toda rota que altera', () => {
  const SOMENTE_GERENCIA: Rota[] = [
    { method: 'POST', url: '/api/products', payload: {} },
    { method: 'POST', url: '/api/products/bulk-delete', payload: { ids: [] } },
    { method: 'POST', url: '/api/categories', payload: {} },
    { method: 'POST', url: '/api/units', payload: {} },
    { method: 'POST', url: '/api/stock/adjust', payload: {} },
    { method: 'POST', url: '/api/stock-counts', payload: {} },
  ]

  test('operador não passa das rotas de gerência', async () => {
    const tenant = await createTenant('erro-papel', '10')
    const cookie = authCookie(ctx.app, tenant.operator)

    for (const rota of SOMENTE_GERENCIA) {
      const resposta = await pedir(rota, cookie)
      assert.equal(resposta.statusCode, 403, `${rota.method} ${rota.url} deixou o operador passar (${resposta.statusCode})`)
    }
  })

  test('gerente não alcança as rotas exclusivas de administrador', async () => {
    const tenant = await createTenant('erro-papel-gerente', '10')
    const cookie = authCookie(ctx.app, tenant.manager)

    for (const url of ['/api/users?page=1&pageSize=5', '/api/logs/activity?page=1&pageSize=5', '/api/company']) {
      const resposta = await ctx.app.inject({ method: 'GET', url, headers: { cookie } })
      assert.equal(resposta.statusCode, 403, `${url} deixou o gerente passar (${resposta.statusCode})`)
    }
  })

  test('admin da empresa não alcança as rotas da plataforma', async () => {
    const tenant = await createTenant('erro-papel-plataforma', '10')
    const cookie = authCookie(ctx.app, tenant.admin)

    for (const url of ['/api/companies?page=1&pageSize=5', '/api/billings?page=1&pageSize=5', '/api/logs/technical?page=1&pageSize=5', '/api/platform-users']) {
      const resposta = await ctx.app.inject({ method: 'GET', url, headers: { cookie } })
      assert.equal(resposta.statusCode, 403, `${url} deixou o admin da empresa passar (${resposta.statusCode})`)
    }
  })
})

describe('dado inválido responde 422 em português, sem vazar detalhe técnico', () => {
  test('cada cadastro recusa corpo vazio com mensagem de campo', async () => {
    const tenant = await createTenant('erro-validacao', '10')
    const cookie = authCookie(ctx.app, tenant.admin)

    for (const url of ['/api/products', '/api/categories', '/api/units', '/api/losses', '/api/stock/adjust']) {
      const resposta = await ctx.app.inject({ method: 'POST', url, headers: { cookie }, payload: {} })
      assert.equal(resposta.statusCode, 422, `${url} respondeu ${resposta.statusCode}`)

      const corpo = resposta.json() as { error: { code: string; message: string; issues?: Record<string, string[]> } }
      assert.equal(corpo.error.code, 'VALIDATION_ERROR')
      assert.equal(corpo.error.message, 'Dados inválidos')
      assert.ok(corpo.error.issues && Object.keys(corpo.error.issues).length > 0, `${url} não disse qual campo falhou`)
      assert.doesNotMatch(resposta.body, /ZodError|at Object\.|node_modules|\.ts:\d+/, `${url} vazou detalhe técnico`)
    }
  })

  // Link quebrado e varredura automática não podem virar erro de servidor: além de mostrar
  // "Erro interno" para o usuário, cada 5xx entra no log como `error` e alimenta o alerta de produção.
  test('identificador que não é uuid responde 404, não erro de servidor', async () => {
    const tenant = await createTenant('erro-uuid', '10')
    const cookie = authCookie(ctx.app, tenant.admin)

    const rotas = [
      '/api/products/abc',
      '/api/categories/abc',
      '/api/units/abc',
      '/api/losses/abc',
      '/api/stock-entries/abc',
      '/api/stock-counts/abc',
      '/api/stock-counts/abc/items?page=1&pageSize=5',
      '/api/users/abc',
    ]

    for (const url of rotas) {
      const resposta = await ctx.app.inject({ method: 'GET', url, headers: { cookie } })
      assert.equal(resposta.statusCode, 404, `${url} respondeu ${resposta.statusCode}`)
      assert.equal(resposta.json().error.code, 'NOT_FOUND')
      assert.doesNotMatch(resposta.body, /uuid|22P02|invalid input syntax/i, `${url} vazou o erro do banco`)
    }
  })
})

describe('etapas da contagem recusam transição fora de ordem', () => {
  async function abrir(admin: FixtureUser) {
    const resposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-counts',
      headers: { cookie: authCookie(ctx.app, admin) },
      payload: {},
    })
    return resposta.json() as { id: string }
  }

  test('reabrir contagem que não está em conferência é recusado', async () => {
    const tenant = await createTenant('erro-reabrir', '10')
    const contagem = await abrir(tenant.admin)

    const resposta = await ctx.app.inject({
      method: 'POST',
      url: `/api/stock-counts/${contagem.id}/reopen`,
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: {},
    })
    assert.equal(resposta.statusCode, 422)
    assert.equal(resposta.json().error.code, 'COUNT_NOT_REVIEW')
  })

  test('encerrar contagem que ainda está sendo contada é recusado', async () => {
    const tenant = await createTenant('erro-encerrar-cedo', '10')
    const contagem = await abrir(tenant.admin)

    const resposta = await ctx.app.inject({
      method: 'POST',
      url: `/api/stock-counts/${contagem.id}/finish`,
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: {},
    })
    assert.equal(resposta.statusCode, 422)
    assert.equal(resposta.json().error.code, 'COUNT_ALREADY_CLOSED')
  })

  test('cancelar sem motivo é recusado', async () => {
    const tenant = await createTenant('erro-cancelar-sem-motivo', '10')
    const contagem = await abrir(tenant.admin)

    const resposta = await ctx.app.inject({
      method: 'POST',
      url: `/api/stock-counts/${contagem.id}/cancel`,
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { cancelReason: '   ' },
    })
    assert.equal(resposta.statusCode, 422)
    assert.ok(resposta.json().error.issues?.cancelReason)
  })
})

describe('troca de senha e leitura de arquivo', () => {
  test('senha atual errada não troca a senha e responde em português', async () => {
    const tenant = await createTenant('erro-senha', '10')
    const resposta = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/auth/password',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { currentPassword: 'nao-e-a-senha', newPassword: 'SenhaNovaForte1' },
    })

    assert.equal(resposta.statusCode, 400)
    assert.equal(resposta.json().error.code, 'INVALID_CURRENT_PASSWORD')
    assert.match(resposta.json().error.message, /[Ss]enha atual/)
  })

  test('leitura de XML sem arquivo responde 422 e não cria entrada', async () => {
    const tenant = await createTenant('erro-xml-sem-arquivo', '10')
    const semArquivo = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries/nfe',
      headers: { cookie: authCookie(ctx.app, tenant.admin), 'content-type': 'multipart/form-data; boundary=sem-arquivo' },
      payload: '--sem-arquivo--\r\n',
    })
    assert.equal(semArquivo.statusCode, 422, semArquivo.body)
    assert.equal(semArquivo.json().error.code, 'FILE_REQUIRED')
    const entradas = await ctx.app.inject({ url: '/api/stock-entries', headers: { cookie: authCookie(ctx.app, tenant.admin) } })
    assert.equal(entradas.json().total, 0)
    assert.doesNotMatch(semArquivo.body, /node_modules|\.ts:\d+/)
  })
})

describe('usuário desativado perde acesso na hora', () => {
  test('desativar o usuário derruba a sessão em qualquer rota', async () => {
    const tenant = await createTenant('erro-desativado', '10')
    const cookie = authCookie(ctx.app, tenant.admin)

    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/products?page=1&pageSize=5', headers: { cookie } })).statusCode, 200)
    await db.update(users).set({ active: false }).where(eq(users.id, tenant.admin.id))

    for (const url of ['/api/products?page=1&pageSize=5', '/api/dashboard/summary', '/api/stock-counts/open']) {
      const resposta = await ctx.app.inject({ method: 'GET', url, headers: { cookie } })
      assert.equal(resposta.statusCode, 401, `${url} continuou respondendo para usuário desativado`)
    }
  })
})
