import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { categories, products, units } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

type ImportResponse = {
  summary: {
    total: number
    valid: number
    invalid: number
    imported: number
    omittedErrors: number
    newCategories: string[]
    newUnits: string[]
  }
  errors: { line: number; name: string; errors: string[] }[]
}

function importRequest(payload: unknown, cookie: string) {
  return ctx.app.inject({ method: 'POST', url: '/api/products/import', headers: { cookie }, payload })
}

function countProducts(companyId: string) {
  return db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.companyId, companyId), isNull(products.deletedAt)))
}

describe('importação de produtos por planilha', () => {
  test('a prévia aponta o erro de cada linha e não grava nada', async () => {
    const tenant = await createTenant('imp-previa')

    const response = await importRequest(
      {
        dryRun: true,
        rows: [
          { line: 2, name: 'Tomate', categoryName: `Categoria imp-previa`, unitName: `Unidade imp-previa` },
          { line: 3, name: '', categoryName: 'Categoria imp-previa', unitName: 'Unidade imp-previa' },
          { line: 4, name: 'Alface', categoryName: 'Inexistente', unitName: 'Unidade imp-previa' },
          {
            line: 5,
            name: 'Cebola',
            categoryName: 'Categoria imp-previa',
            unitName: 'Unidade imp-previa',
            costPrice: 'abc',
          },
        ],
      },
      authCookie(ctx.app, tenant.admin),
    )

    assert.equal(response.statusCode, 200)
    const body = response.json<ImportResponse>()
    assert.equal(body.summary.total, 4)
    assert.equal(body.summary.valid, 1)
    assert.equal(body.summary.invalid, 3)
    assert.equal(body.summary.imported, 0)

    const byLine = new Map(body.errors.map((item) => [item.line, item.errors]))
    assert.match(byLine.get(3)!.join(' '), /Nome é obrigatório/)
    assert.match(byLine.get(4)!.join(' '), /Categoria "Inexistente" não existe/)
    assert.match(byLine.get(5)!.join(' '), /Custo inválido/)

    // Só o produto criado pela fixture continua lá
    assert.equal((await countProducts(tenant.companyId)).length, 1)
  })

  test('importa criando as categorias e unidades que faltavam', async () => {
    const tenant = await createTenant('imp-ok')

    const response = await importRequest(
      {
        createMissingRefs: true,
        rows: [
          { line: 2, name: 'Tomate Italiano', categoryName: 'Legumes', unitName: 'Quilograma', costPrice: '7,49' },
          { line: 3, name: 'Alface Crespa', categoryName: 'Verduras', unitName: 'Unidade', minStock: '10' },
          { line: 4, name: 'Banana Prata', categoryName: 'Legumes', unitName: 'Quilograma', active: 'não' },
        ],
      },
      authCookie(ctx.app, tenant.admin),
    )

    assert.equal(response.statusCode, 200)
    const body = response.json<ImportResponse>()
    assert.equal(body.summary.invalid, 0)
    assert.equal(body.summary.imported, 3)
    assert.deepEqual(body.summary.newCategories.sort(), ['Legumes', 'Verduras'])

    const saved = await db
      .select({ name: products.name, costPrice: products.costPrice, minStock: products.minStock, active: products.active })
      .from(products)
      .where(and(eq(products.companyId, tenant.companyId), isNull(products.deletedAt)))

    const tomate = saved.find((item) => item.name === 'Tomate Italiano')!
    assert.equal(Number(tomate.costPrice), 7.49, 'valor em formato brasileiro deve virar 7.49')
    assert.equal(Number(saved.find((item) => item.name === 'Alface Crespa')!.minStock), 10)
    assert.equal(saved.find((item) => item.name === 'Banana Prata')!.active, false)

    // As duas linhas de "Legumes" devem apontar para a MESMA categoria criada
    const createdCategories = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.companyId, tenant.companyId), isNull(categories.deletedAt)))
    assert.equal(createdCategories.filter((item) => item.name === 'Legumes').length, 1)

    const createdUnits = await db
      .select({ name: units.name })
      .from(units)
      .where(and(eq(units.companyId, tenant.companyId), isNull(units.deletedAt)))
    assert.equal(createdUnits.filter((item) => item.name === 'Quilograma').length, 1)
  })

  test('uma linha inválida cancela a importação inteira', async () => {
    const tenant = await createTenant('imp-atomico')

    const response = await importRequest(
      {
        createMissingRefs: true,
        rows: [
          { line: 2, name: 'Manga', categoryName: 'Frutas', unitName: 'Quilo' },
          { line: 3, name: 'Uva', categoryName: 'Frutas', unitName: 'Quilo', salePrice: 'nao-e-numero' },
        ],
      },
      authCookie(ctx.app, tenant.admin),
    )

    assert.equal(response.statusCode, 200)
    const body = response.json<ImportResponse>()
    assert.equal(body.summary.imported, 0)
    assert.equal((await countProducts(tenant.companyId)).length, 1, 'nem a linha válida pode ter sido gravada')

    const createdCategories = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.companyId, tenant.companyId), eq(categories.name, 'Frutas'), isNull(categories.deletedAt)))
    assert.equal(createdCategories.length, 0, 'a categoria nova não pode sobrar de uma importação cancelada')
  })

  test('acusa nome repetido dentro do próprio arquivo e nome que já existe no sistema', async () => {
    const tenant = await createTenant('imp-dup')

    const response = await importRequest(
      {
        dryRun: true,
        rows: [
          { line: 2, name: 'Pêra', categoryName: 'Categoria imp-dup', unitName: 'Unidade imp-dup' },
          { line: 3, name: 'pêra', categoryName: 'Categoria imp-dup', unitName: 'Unidade imp-dup' },
          { line: 4, name: 'Produto imp-dup', categoryName: 'Categoria imp-dup', unitName: 'Unidade imp-dup' },
        ],
      },
      authCookie(ctx.app, tenant.admin),
    )

    const body = response.json<ImportResponse>()
    const byLine = new Map(body.errors.map((item) => [item.line, item.errors.join(' ')]))
    assert.match(byLine.get(3)!, /Já existe um produto chamado/, 'duplicata dentro do arquivo, ignorando maiúsculas')
    assert.match(byLine.get(4)!, /Já existe um produto chamado/, 'duplicata contra o que já está no banco')
  })

  test('a unidade pode ser referenciada pela abreviação', async () => {
    const tenant = await createTenant('imp-abrev')

    const response = await importRequest(
      {
        rows: [{ line: 2, name: 'Beterraba', categoryName: 'Categoria imp-abrev', unitName: 'uimp-abrev' }],
      },
      authCookie(ctx.app, tenant.admin),
    )

    const body = response.json<ImportResponse>()
    assert.equal(body.summary.imported, 1, JSON.stringify(body.errors))

    const [saved] = await db
      .select({ unitId: products.unitId })
      .from(products)
      .where(and(eq(products.companyId, tenant.companyId), eq(products.name, 'Beterraba')))
    assert.equal(saved.unitId, tenant.unitId)
  })

  test('operador não pode importar produtos', async () => {
    const tenant = await createTenant('imp-papel')

    const response = await importRequest(
      { rows: [{ line: 2, name: 'Couve', categoryName: 'Categoria imp-papel', unitName: 'Unidade imp-papel' }] },
      authCookie(ctx.app, tenant.operator),
    )

    assert.equal(response.statusCode, 403)
    assert.equal((await countProducts(tenant.companyId)).length, 1)
  })

  test('não enxerga categoria de outra empresa', async () => {
    const tenantA = await createTenant('imp-iso-a')
    const tenantB = await createTenant('imp-iso-b')

    const response = await importRequest(
      {
        dryRun: true,
        rows: [{ line: 2, name: 'Rúcula', categoryName: 'Categoria imp-iso-b', unitName: 'Unidade imp-iso-a' }],
      },
      authCookie(ctx.app, tenantA.admin),
    )

    const body = response.json<ImportResponse>()
    assert.equal(body.summary.invalid, 1)
    assert.match(body.errors[0].errors.join(' '), /não existe/)
    assert.ok(tenantB.companyId)
  })
})
