import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { stockMovements } from '../src/db/schema/index.js'
import { MAX_BACKDATE_DAYS } from '../src/shared/schemas/eventDate.schema.js'
import { addDaysToIsoDate, businessDate, todayIsoDate } from '../src/shared/utils/date.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

const ONTEM = () => addDaysToIsoDate(todayIsoDate(), -1)
const AMANHA = () => addDaysToIsoDate(todayIsoDate(), 1)

async function movimentosDoProduto(productId: string) {
  return db
    .select({
      type: stockMovements.type,
      movementDate: stockMovements.movementDate,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId))
}

describe('data retroativa em entradas e perdas', () => {
  test('entrada de ontem datou também a movimentação de estoque', async () => {
    const tenant = await createTenant('entrada-ontem')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: {
        entryDate: ONTEM(),
        supplierName: 'Chegou ontem e ninguém lançou',
        items: [{ productId: tenant.productId, quantity: 10 }],
      },
    })

    assert.equal(response.statusCode, 201)
    assert.equal(businessDate(new Date(response.json<{ entryDate: string }>().entryDate)), ONTEM())

    const [movimento] = await movimentosDoProduto(tenant.productId)
    assert.equal(businessDate(movimento.movementDate), ONTEM(), 'a movimentação segue a data informada')
    assert.equal(businessDate(movimento.createdAt), todayIsoDate(), 'o lançamento continua sendo de hoje')
  })

  test('perda de ontem datou também a movimentação de estoque', async () => {
    const tenant = await createTenant('perda-ontem', '50')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { productId: tenant.productId, quantity: 4, reason: 'avariado', lossDate: ONTEM() },
    })

    assert.equal(response.statusCode, 201)

    const [movimento] = await movimentosDoProduto(tenant.productId)
    assert.equal(movimento.type, 'perda')
    assert.equal(businessDate(movimento.movementDate), ONTEM())
    assert.equal(businessDate(movimento.createdAt), todayIsoDate())
  })

  test('sem data informada, o lançamento é de hoje', async () => {
    const tenant = await createTenant('sem-data')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { items: [{ productId: tenant.productId, quantity: 1 }] },
    })

    assert.equal(response.statusCode, 201)
    const [movimento] = await movimentosDoProduto(tenant.productId)
    assert.equal(businessDate(movimento.movementDate), todayIsoDate())
  })

  test('data futura é recusada nas duas telas', async () => {
    const tenant = await createTenant('data-futura', '50')
    const cookie = authCookie(ctx.app, tenant.operator)

    const entrada = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie },
      payload: { entryDate: AMANHA(), items: [{ productId: tenant.productId, quantity: 1 }] },
    })
    assert.equal(entrada.statusCode, 422)
    assert.deepEqual(entrada.json<{ error: { issues: Record<string, string[]> } }>().error.issues.entryDate, [
      'A data não pode ser futura',
    ])

    const perda = await ctx.app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie },
      payload: { productId: tenant.productId, quantity: 1, reason: 'outro', lossDate: AMANHA() },
    })
    assert.equal(perda.statusCode, 422)
    assert.deepEqual(perda.json<{ error: { issues: Record<string, string[]> } }>().error.issues.lossDate, [
      'A data não pode ser futura',
    ])

    assert.equal((await movimentosDoProduto(tenant.productId)).length, 0, 'nada foi gravado')
  })

  test('data anterior à janela permitida é recusada, e a borda da janela é aceita', async () => {
    const tenant = await createTenant('janela')
    const cookie = authCookie(ctx.app, tenant.operator)

    const foraDaJanela = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie },
      payload: {
        entryDate: addDaysToIsoDate(todayIsoDate(), -(MAX_BACKDATE_DAYS + 1)),
        items: [{ productId: tenant.productId, quantity: 1 }],
      },
    })
    assert.equal(foraDaJanela.statusCode, 422)

    const naBorda = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie },
      payload: {
        entryDate: addDaysToIsoDate(todayIsoDate(), -MAX_BACKDATE_DAYS),
        items: [{ productId: tenant.productId, quantity: 1 }],
      },
    })
    assert.equal(naBorda.statusCode, 201)
  })

  test('data impossível é recusada em vez de virar outro dia', async () => {
    const tenant = await createTenant('data-impossivel')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { entryDate: '2026-02-31', items: [{ productId: tenant.productId, quantity: 1 }] },
    })

    assert.equal(response.statusCode, 422)
  })

  test('perda retroativa entra no período de ontem, não no de hoje', async () => {
    const tenant = await createTenant('periodo-retroativo', '50')
    const cookie = authCookie(ctx.app, tenant.operator)

    await ctx.app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie },
      payload: { productId: tenant.productId, quantity: 3, reason: 'vencido', lossDate: ONTEM() },
    })

    const deOntem = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock/movements?from=${ONTEM()}&to=${ONTEM()}`,
      headers: { cookie },
    })
    assert.equal(deOntem.statusCode, 200)
    assert.equal(deOntem.json<{ data: unknown[] }>().data.length, 1, 'a movimentação aparece no dia informado')

    const deHoje = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock/movements?from=${todayIsoDate()}&to=${todayIsoDate()}`,
      headers: { cookie },
    })
    assert.equal(deHoje.json<{ data: unknown[] }>().data.length, 0, 'e não aparece no dia em que foi digitada')
  })

  // O motivo desta mudança existir: antes, o total de perdas seguia `losses.loss_date` e o gráfico
  // seguia o instante do lançamento. Uma perda retroativa aparecia em dias diferentes nos dois.
  test('no painel, o total de perdas e o gráfico caem no mesmo dia informado', async () => {
    const tenant = await createTenant('painel-retroativo', '50')
    const cookie = authCookie(ctx.app, tenant.operator)

    await ctx.app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie },
      payload: { productId: tenant.productId, quantity: 6, reason: 'vencido', lossDate: ONTEM() },
    })

    type Summary = {
      lossesInPeriod: { lossesCount: number }
      movementsTimeline: { date: string; perdaCount: number }[]
    }

    const ontem = await ctx.app.inject({
      method: 'GET',
      url: `/api/dashboard/summary?from=${ONTEM()}&to=${ONTEM()}`,
      headers: { cookie },
    })
    assert.equal(ontem.statusCode, 200)
    const dadosDeOntem = ontem.json<Summary>()
    assert.equal(dadosDeOntem.lossesInPeriod.lossesCount, 1)
    assert.deepEqual(
      dadosDeOntem.movementsTimeline.map((linha) => [linha.date, linha.perdaCount]),
      [[ONTEM(), 1]],
      'o gráfico marca a perda no dia informado',
    )

    const hoje = await ctx.app.inject({
      method: 'GET',
      url: `/api/dashboard/summary?from=${todayIsoDate()}&to=${todayIsoDate()}`,
      headers: { cookie },
    })
    const dadosDeHoje = hoje.json<Summary>()
    assert.equal(dadosDeHoje.lossesInPeriod.lossesCount, 0)
    assert.deepEqual(
      dadosDeHoje.movementsTimeline.map((linha) => linha.perdaCount),
      [0],
      'e nada no dia em que foi digitada',
    )
  })
})
