import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { db } from './db.js'
import { companies } from '../src/db/schema/index.js'
import { authCookie, createTenant, createUser, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

async function fixture(suffix: string) {
  const target = await createTenant(`billing-${suffix}`)
  const [platform] = await db.insert(companies).values({ name: `Plataforma ${suffix}` }).returning({ id: companies.id })
  const superAdmin = await createUser(platform.id, 'super_admin', `billing-${suffix}`)
  return { target, superAdmin }
}

describe('controle manual de cobranças', () => {
  test('super_admin cadastra, marca pagamento e lista a mensalidade', async () => {
    const { target, superAdmin } = await fixture('crud')
    const cookie = authCookie(ctx.app, superAdmin)
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/billings',
      headers: { cookie },
      payload: {
        companyId: target.companyId,
        referenceMonth: '2026-08',
        dueDate: '2026-08-10',
        amount: 149.9,
        paidAmount: null,
        paidAt: null,
        notes: 'Plano mensal',
      },
    })
    assert.equal(created.statusCode, 201)
    const billing = created.json<{ id: string }>()

    const updated = await ctx.app.inject({
      method: 'PUT',
      url: `/api/billings/${billing.id}`,
      headers: { cookie },
      payload: {
        companyId: target.companyId,
        referenceMonth: '2026-08',
        dueDate: '2026-08-10',
        amount: 149.9,
        paidAmount: 149.9,
        paidAt: '2026-08-09',
        notes: 'Pago por Pix',
      },
    })
    assert.equal(updated.statusCode, 200)

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/billings?page=1&pageSize=15&from=2026-08-01&to=2026-08-31&status=paid',
      headers: { cookie },
    })
    assert.equal(list.statusCode, 200)
    const result = list.json<{ total: number; data: Array<{ paidAmount: string; companyName: string }> }>()
    assert.equal(result.total, 1)
    assert.equal(result.data[0].paidAmount, '149.90')
    assert.match(result.data[0].companyName, /billing-crud/)
  })

  test('impede duas cobranças da mesma empresa na mesma competência', async () => {
    const { target, superAdmin } = await fixture('duplicate')
    const request = {
      method: 'POST' as const,
      url: '/api/billings',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: {
        companyId: target.companyId,
        referenceMonth: '2026-09',
        dueDate: '2026-09-10',
        amount: 199.9,
        paidAmount: null,
        paidAt: null,
        notes: null,
      },
    }
    assert.equal((await ctx.app.inject(request)).statusCode, 201)
    const duplicate = await ctx.app.inject(request)
    assert.equal(duplicate.statusCode, 409)
    assert.match(duplicate.body, /Já existe uma cobrança/)
  })

  test('classifica pendente e atrasado pelo vencimento e remove a cobrança', async () => {
    const { target, superAdmin } = await fixture('status')
    const cookie = authCookie(ctx.app, superAdmin)
    const create = (referenceMonth: string, dueDate: string) =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/billings',
        headers: { cookie },
        payload: { companyId: target.companyId, referenceMonth, dueDate, amount: 99.9, paidAmount: null, paidAt: null, notes: null },
      })

    const overdue = await create('2020-01', '2020-01-10')
    assert.equal(overdue.statusCode, 201)
    assert.equal((await create('2999-01', '2999-01-10')).statusCode, 201)

    const listByStatus = async (status: string) => {
      const response = await ctx.app.inject({
        method: 'GET',
        url: `/api/billings?page=1&pageSize=15&search=billing-status&status=${status}`,
        headers: { cookie },
      })
      assert.equal(response.statusCode, 200)
      return response.json<{ total: number; data: Array<{ status: string; dueDate: string }> }>()
    }

    const overdueList = await listByStatus('overdue')
    assert.equal(overdueList.total, 1)
    assert.equal(overdueList.data[0].dueDate, '2020-01-10')
    assert.equal(overdueList.data[0].status, 'overdue')

    const pendingList = await listByStatus('pending')
    assert.equal(pendingList.total, 1)
    assert.equal(pendingList.data[0].dueDate, '2999-01-10')
    assert.equal(pendingList.data[0].status, 'pending')

    const removed = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/billings/${overdue.json<{ id: string }>().id}`,
      headers: { cookie },
    })
    assert.equal(removed.statusCode, 204)
    assert.equal((await listByStatus('overdue')).total, 0)

    const missing = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/billings/${overdue.json<{ id: string }>().id}`,
      headers: { cookie },
    })
    assert.equal(missing.statusCode, 404)
  })

  test('usuários das empresas não acessam o financeiro da plataforma', async () => {
    const tenant = await createTenant('billing-forbidden')
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/billings?page=1&pageSize=15',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })
    assert.equal(response.statusCode, 403)
  })
})
