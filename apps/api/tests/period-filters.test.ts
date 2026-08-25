import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { db } from './db.js'
import { losses, stockEntries, stockMovements } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

/**
 * O front manda a data civil escolhida pelo usuário, sem hora (`lib/period.ts`), e o
 * negócio roda em `America/Sao_Paulo` enquanto os containers rodam em UTC. Antes
 * dessas garantias, `to=2026-08-14` virava "até a meia-noite UTC de 14/08" (21h de
 * 13/08 em Brasília): o preset "hoje" devolvia zero mesmo com lançamento feito pela
 * manhã.
 *
 * Brasília está em UTC-3 (sem horário de verão desde 2019), então os instantes abaixo
 * estão escritos em UTC com o horário local correspondente no comentário.
 */
const DIA = '2026-08-14'
const DEZ_DA_MANHA = new Date('2026-08-14T13:00:00.000Z') // 14/08 10:00 em Brasília
const ULTIMA_MEIA_HORA = new Date('2026-08-15T02:30:00.000Z') // 14/08 23:30 em Brasília
const JA_NO_DIA_SEGUINTE = new Date('2026-08-15T03:30:00.000Z') // 15/08 00:30 em Brasília

const PERIODO_DO_DIA = `from=${DIA}&to=${DIA}`

describe('filtro de período pelo fuso do negócio', () => {
  it('perdas: o dia filtrado vai da primeira à última hora local', async () => {
    const tenant = await createTenant('perdas-periodo', '1000')
    const cookie = authCookie(ctx.app, tenant.admin)

    for (const lossDate of [DEZ_DA_MANHA, ULTIMA_MEIA_HORA, JA_NO_DIA_SEGUINTE]) {
      await db.insert(losses).values({
        companyId: tenant.companyId,
        productId: tenant.productId,
        quantity: '1',
        reason: 'vencido',
        lossDate,
        createdBy: tenant.admin.id,
      })
    }

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/losses?${PERIODO_DO_DIA}`,
      headers: { cookie },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().total, 2, 'deve pegar 10h e 23h30 do dia, e não a madrugada seguinte')
  })

  it('entradas: o dia filtrado vai da primeira à última hora local', async () => {
    const tenant = await createTenant('entradas-periodo')
    const cookie = authCookie(ctx.app, tenant.admin)

    for (const entryDate of [DEZ_DA_MANHA, ULTIMA_MEIA_HORA, JA_NO_DIA_SEGUINTE]) {
      await db.insert(stockEntries).values({
        companyId: tenant.companyId,
        supplierName: 'Fornecedor',
        entryDate,
        createdBy: tenant.admin.id,
      })
    }

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-entries?${PERIODO_DO_DIA}`,
      headers: { cookie },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().total, 2)
  })

  it('movimentações: o dia filtrado vai da primeira à última hora local', async () => {
    const tenant = await createTenant('mov-periodo', '1000')
    const cookie = authCookie(ctx.app, tenant.admin)

    for (const instant of [DEZ_DA_MANHA, ULTIMA_MEIA_HORA, JA_NO_DIA_SEGUINTE]) {
      await db.insert(stockMovements).values({
        companyId: tenant.companyId,
        productId: tenant.productId,
        type: 'perda',
        quantity: '-1',
        balanceAfter: '999',
        referenceType: 'loss',
        referenceId: tenant.productId,
        movementDate: instant,
        createdAt: instant,
        createdBy: tenant.admin.id,
      })
    }

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock/movements?${PERIODO_DO_DIA}`,
      headers: { cookie },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().total, 2)
  })

  it('relatório de perdas soma o dia inteiro, inclusive nos agregados por motivo', async () => {
    const tenant = await createTenant('relatorio-periodo', '1000')
    const cookie = authCookie(ctx.app, tenant.admin)

    for (const lossDate of [DEZ_DA_MANHA, ULTIMA_MEIA_HORA, JA_NO_DIA_SEGUINTE]) {
      await db.insert(losses).values({
        companyId: tenant.companyId,
        productId: tenant.productId,
        quantity: '3',
        reason: 'vencido',
        lossDate,
        createdBy: tenant.admin.id,
      })
    }

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/reports/losses?${PERIODO_DO_DIA}`,
      headers: { cookie },
    })

    assert.equal(response.statusCode, 200)
    const body = response.json()
    assert.equal(body.total, 2)
    assert.deepEqual(body.byReason, [{ reason: 'vencido', quantity: 6, occurrences: 2 }])
  })

  it('dashboard coloca a movimentação das 22h no dia local, não no seguinte em UTC', async () => {
    const tenant = await createTenant('dashboard-fuso', '1000')
    const cookie = authCookie(ctx.app, tenant.admin)

    await db.insert(stockMovements).values({
      companyId: tenant.companyId,
      productId: tenant.productId,
      type: 'perda',
      quantity: '-5',
      balanceAfter: '995',
      referenceType: 'loss',
      referenceId: tenant.productId,
      movementDate: new Date('2026-08-15T01:00:00.000Z'), // 14/08 22:00 em Brasília
      createdAt: new Date('2026-08-15T01:00:00.000Z'),
      createdBy: tenant.admin.id,
    })

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard/summary?from=2026-08-01&to=2026-08-31',
      headers: { cookie },
    })

    assert.equal(response.statusCode, 200)
    const body = response.json()
    const diasComPerda = (body.movementsTimeline as Array<{ date: string; perdaCount: number }>)
      .filter((dia) => dia.perdaCount > 0)
      .map((dia) => dia.date)

    assert.deepEqual(diasComPerda, ['2026-08-14'])
    assert.equal(body.periodFrom, '2026-08-01')
    assert.equal(body.periodTo, '2026-08-31')
  })

  it('dashboard cobre o período pedido dia a dia, sem faltar nem sobrar', async () => {
    const tenant = await createTenant('dashboard-dias')
    const cookie = authCookie(ctx.app, tenant.admin)

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard/summary?from=2026-08-01&to=2026-08-07',
      headers: { cookie },
    })

    const timeline = response.json().movementsTimeline as Array<{ date: string }>
    assert.deepEqual(
      timeline.map((dia) => dia.date),
      ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'],
    )
  })

  it('período maior que o teto é limitado a 90 dias cheios', async () => {
    const tenant = await createTenant('dashboard-teto')
    const cookie = authCookie(ctx.app, tenant.admin)

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard/summary?from=2025-01-01&to=2026-08-31',
      headers: { cookie },
    })

    const body = response.json()
    assert.equal(body.movementsTimeline.length, 90)
    assert.equal(body.periodTo, '2026-08-31')
    assert.equal(body.periodFrom, '2026-06-03')
  })

  it('data impossível é recusada em vez de virar outro dia', async () => {
    const tenant = await createTenant('data-invalida')
    const cookie = authCookie(ctx.app, tenant.admin)

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/losses?from=2026-13-45',
      headers: { cookie },
    })

    assert.equal(response.statusCode, 422)
  })
})
