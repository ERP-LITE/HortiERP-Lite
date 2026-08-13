import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { categories, products, stockMovements, units } from '../src/db/schema/index.js'
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

describe('carga inicial de estoque pela planilha', () => {
  test('o estoque entra como ajuste rastreável, não como saldo do nada', async () => {
    const tenant = await createTenant('imp-estoque')

    const response = await importRequest(
      {
        createMissingRefs: true,
        rows: [
          { line: 2, name: 'Tomate', categoryName: 'Legumes', unitName: 'Quilo', costPrice: '4,00', currentStock: '38,5' },
          { line: 3, name: 'Alface', categoryName: 'Verduras', unitName: 'Unidade', costPrice: '2,00', currentStock: '12' },
          { line: 4, name: 'Sem estoque', categoryName: 'Legumes', unitName: 'Quilo', costPrice: '1,00' },
        ],
      },
      authCookie(ctx.app, tenant.admin),
    )

    const body = response.json<ImportResponse & { summary: { withInitialStock: number } }>()
    assert.equal(body.summary.imported, 3, JSON.stringify(body.errors))
    assert.equal(body.summary.withInitialStock, 2, 'só as linhas com quantidade contam')

    const saldos = await db
      .select({ name: products.name, currentStock: products.currentStock })
      .from(products)
      .where(and(eq(products.companyId, tenant.companyId), isNull(products.deletedAt)))
    const porNome = new Map(saldos.map((item) => [item.name, Number(item.currentStock)]))
    assert.equal(porNome.get('Tomate'), 38.5, 'aceita quantidade fracionada em formato brasileiro')
    assert.equal(porNome.get('Alface'), 12)
    assert.equal(porNome.get('Sem estoque'), 0)

    // O ponto principal: o saldo precisa estar explicado no histórico
    const movimentos = await db
      .select({
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        balanceAfter: stockMovements.balanceAfter,
        notes: stockMovements.notes,
        createdBy: stockMovements.createdBy,
      })
      .from(stockMovements)
      .where(eq(stockMovements.companyId, tenant.companyId))

    assert.equal(movimentos.length, 2, 'um movimento por produto com estoque, e nenhum para os sem')
    for (const movimento of movimentos) {
      assert.equal(movimento.type, 'ajuste')
      assert.match(movimento.notes ?? '', /[Cc]arga inicial/)
      assert.equal(movimento.createdBy, tenant.admin.id, 'o histórico precisa dizer quem fez a carga')
      assert.equal(
        Number(movimento.quantity),
        Number(movimento.balanceAfter),
        'partindo de zero, a quantidade lançada e o saldo resultante coincidem',
      )
    }
  })

  test('quantidade sem custo é sinalizada mas não bloqueia', async () => {
    const tenant = await createTenant('imp-sem-custo')

    const response = await importRequest(
      {
        dryRun: true,
        createMissingRefs: true,
        rows: [
          { line: 2, name: 'Cebola', categoryName: 'Legumes', unitName: 'Quilo', currentStock: '20' },
          { line: 3, name: 'Alho', categoryName: 'Legumes', unitName: 'Quilo', currentStock: '5', costPrice: '30,00' },
        ],
      },
      authCookie(ctx.app, tenant.admin),
    )

    const body = response.json<
      ImportResponse & { summary: { withInitialStock: number; initialStockWithoutCost: number } }
    >()
    assert.equal(body.summary.invalid, 0, 'falta de custo não é erro')
    assert.equal(body.summary.withInitialStock, 2)
    assert.equal(body.summary.initialStockWithoutCost, 1, 'só a Cebola está sem custo')
  })

  test('quantidade inválida cancela tudo e não deixa movimentação órfã', async () => {
    const tenant = await createTenant('imp-estoque-erro')

    await importRequest(
      {
        createMissingRefs: true,
        rows: [
          { line: 2, name: 'Pepino', categoryName: 'Legumes', unitName: 'Quilo', currentStock: '10' },
          { line: 3, name: 'Abobrinha', categoryName: 'Legumes', unitName: 'Quilo', currentStock: 'dez quilos' },
        ],
      },
      authCookie(ctx.app, tenant.admin),
    )

    const movimentos = await db
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(eq(stockMovements.companyId, tenant.companyId))
    assert.equal(movimentos.length, 0, 'nenhum movimento pode sobrar de uma importação cancelada')
    assert.equal((await countProducts(tenant.companyId)).length, 1)
  })
})
