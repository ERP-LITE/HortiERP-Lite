import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from './db.js'
import { categories, products, units } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

async function inativarUnidade(id: string, cookie: string) {
  return ctx.app.inject({
    method: 'PUT',
    url: `/api/units/${id}`,
    headers: { cookie },
    payload: { active: false },
  })
}

describe('unidade e categoria inativas', () => {
  test('inativar não apaga e tira da lista de ativas', async () => {
    const tenant = await createTenant('inativa-lista')
    const cookie = authCookie(ctx.app, tenant.admin)

    assert.equal((await inativarUnidade(tenant.unitId, cookie)).statusCode, 200)

    const [unit] = await db.select().from(units).where(eq(units.id, tenant.unitId))
    assert.equal(unit.active, false)
    assert.equal(unit.deletedAt, null)

    const ativas = await ctx.app.inject({ method: 'GET', url: '/api/units?active=true', headers: { cookie } })
    const inativas = await ctx.app.inject({ method: 'GET', url: '/api/units?active=false', headers: { cookie } })
    assert.equal(ativas.json<{ data: unknown[] }>().data.length, 0)
    assert.equal(inativas.json<{ data: unknown[] }>().data.length, 1)
  })

  test('produto novo não aceita unidade inativa', async () => {
    const tenant = await createTenant('inativa-produto-novo')
    const cookie = authCookie(ctx.app, tenant.admin)
    await inativarUnidade(tenant.unitId, cookie)

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie },
      payload: { name: 'Produto novo', categoryId: tenant.categoryId, unitId: tenant.unitId },
    })

    assert.equal(response.statusCode, 409)
    assert.match(response.body, /unidade está inativa/)
  })

  test('produto que já usa a unidade inativa continua editável', async () => {
    const tenant = await createTenant('inativa-produto-antigo')
    const cookie = authCookie(ctx.app, tenant.admin)
    await inativarUnidade(tenant.unitId, cookie)

    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/products/${tenant.productId}`,
      headers: { cookie },
      payload: {
        name: 'Nome corrigido',
        categoryId: tenant.categoryId,
        unitId: tenant.unitId,
        minStock: 5,
      },
    })

    assert.equal(response.statusCode, 200)
    const [product] = await db.select().from(products).where(eq(products.id, tenant.productId))
    assert.equal(product.name, 'Nome corrigido')
  })

  test('importação reaproveita a unidade inativa em vez de criar outra igual', async () => {
    const tenant = await createTenant('inativa-import')
    const cookie = authCookie(ctx.app, tenant.admin)
    const [unidade] = await db.select().from(units).where(eq(units.id, tenant.unitId))
    await inativarUnidade(tenant.unitId, cookie)

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/products/import',
      headers: { cookie },
      payload: {
        createMissingRefs: true,
        rows: [{ line: 2, name: 'Melão', categoryName: 'Frutas import-inativa', unitName: unidade.name }],
      },
    })

    assert.equal(response.statusCode, 200)
    const body = response.json<{
      summary: { imported: number; newUnits: string[] }
      preview: { inactiveUnit: boolean; newUnit: boolean }[]
    }>()
    assert.equal(body.summary.imported, 1)
    assert.deepEqual(body.summary.newUnits, [])
    assert.equal(body.preview[0].newUnit, false)
    assert.equal(body.preview[0].inactiveUnit, true)

    const doBanco = await db
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.companyId, tenant.companyId), isNull(units.deletedAt)))
    assert.equal(doBanco.length, 1)
  })

  test('categoria inativa também é recusada em produto novo', async () => {
    const tenant = await createTenant('inativa-categoria')
    const cookie = authCookie(ctx.app, tenant.admin)

    const inativacao = await ctx.app.inject({
      method: 'PUT',
      url: `/api/categories/${tenant.categoryId}`,
      headers: { cookie },
      payload: { active: false },
    })
    assert.equal(inativacao.statusCode, 200)

    const [category] = await db.select().from(categories).where(eq(categories.id, tenant.categoryId))
    assert.equal(category.active, false)

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie },
      payload: { name: 'Outro produto', categoryId: tenant.categoryId, unitId: tenant.unitId },
    })
    assert.equal(response.statusCode, 409)
    assert.match(response.body, /categoria está inativa/)
  })
})

describe('filtro de unidade na listagem de produtos', () => {
  test('lista só os produtos da unidade escolhida', async () => {
    const tenant = await createTenant('filtro-unidade')
    const cookie = authCookie(ctx.app, tenant.admin)

    const [outraUnidade] = await db
      .insert(units)
      .values({
        companyId: tenant.companyId,
        name: 'Caixa filtro-unidade',
        abbreviation: 'cx-fu',
        createdBy: tenant.admin.id,
      })
      .returning({ id: units.id })

    await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie },
      payload: { name: 'Produto da caixa', categoryId: tenant.categoryId, unitId: outraUnidade.id },
    })

    const daCaixa = await ctx.app.inject({
      method: 'GET',
      url: `/api/products?unitId=${outraUnidade.id}`,
      headers: { cookie },
    })
    const todos = await ctx.app.inject({ method: 'GET', url: '/api/products', headers: { cookie } })

    assert.deepEqual(
      daCaixa.json<{ data: { name: string }[] }>().data.map(({ name }) => name),
      ['Produto da caixa'],
    )
    assert.equal(todos.json<{ data: unknown[] }>().data.length, 2)
  })
})
