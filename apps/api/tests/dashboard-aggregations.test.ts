import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { products, units } from '../src/db/schema/index.js'
import { createLoss } from './servicos.js'
import { authCookie, createTenant, setupTestApp, type TenantFixture } from './helpers.js'

const ctx = setupTestApp()

type Summary = {
  stockByCategory: {
    categoryName: string
    productCount: number
    totalsByUnit: { unitAbbreviation: string; quantity: number }[]
    products: { productName: string; quantity: number }[]
    otherProductsCount: number
  }[]
  lossesByReason: {
    reason: string
    lossesCount: number
    totalsByUnit: { unitAbbreviation: string; quantity: number }[]
    products: { productName: string; quantity: number }[]
    otherProductsCount: number
  }[]
}

function resumo(tenant: TenantFixture) {
  return ctx.app
    .inject({ method: 'GET', url: '/api/dashboard/summary', headers: { cookie: authCookie(ctx.app, tenant.admin) } })
    .then((response) => {
      assert.equal(response.statusCode, 200)
      return response.json<Summary>()
    })
}

async function criarProdutos(tenant: TenantFixture, definicoes: { name: string; stock: string }[]) {
  return db
    .insert(products)
    .values(
      definicoes.map((definicao) => ({
        companyId: tenant.companyId,
        categoryId: tenant.categoryId,
        unitId: tenant.unitId,
        name: definicao.name,
        currentStock: definicao.stock,
        costPrice: '1.00',
        createdBy: tenant.admin.id,
      })),
    )
    .returning({ id: products.id, name: products.name })
}

describe('produtos por categoria no painel', () => {
  test('produto zerado conta como produto da categoria, mas não entra nos totais por unidade', async () => {
    const tenant = await createTenant('cat-zerado', '0')
    await criarProdutos(tenant, [
      { name: 'Com saldo A', stock: '10' },
      { name: 'Com saldo B', stock: '5' },
      { name: 'Zerado', stock: '0' },
    ])

    const { stockByCategory } = await resumo(tenant)
    const categoria = stockByCategory.find((item) => item.categoryName.startsWith('Categoria'))
    assert.ok(categoria)

    assert.equal(
      categoria.productCount,
      4,
      'os 3 criados aqui + o do fixture: todo produto ativo conta, com ou sem saldo',
    )
    assert.equal(categoria.totalsByUnit.length, 1)
    assert.equal(categoria.totalsByUnit[0].quantity, 15, 'só soma quem tem saldo')
    assert.deepEqual(
      categoria.products.map((item) => item.productName),
      ['Com saldo A', 'Com saldo B'],
      'o detalhamento lista apenas os produtos com saldo, do maior para o menor',
    )
    assert.equal(categoria.otherProductsCount, 0)
  })

  test('categoria sem nenhum produto com saldo não devolve total por unidade', async () => {
    const tenant = await createTenant('cat-tudo-zerado', '0')

    const { stockByCategory } = await resumo(tenant)
    const categoria = stockByCategory.find((item) => item.categoryName.startsWith('Categoria'))
    assert.ok(categoria)
    assert.equal(categoria.productCount, 1)
    assert.deepEqual(categoria.totalsByUnit, [], 'exibir "0" sugeriria que existe algo em estoque')
  })

  test('corta o detalhamento nos 5 maiores e conta a sobra', async () => {
    const tenant = await createTenant('cat-top-n', '0')
    await criarProdutos(
      tenant,
      Array.from({ length: 8 }, (_, index) => ({
        name: `Produto ${String(index + 1).padStart(2, '0')}`,
        stock: String((index + 1) * 10),
      })),
    )

    const { stockByCategory } = await resumo(tenant)
    const categoria = stockByCategory.find((item) => item.categoryName.startsWith('Categoria'))
    assert.ok(categoria)

    assert.equal(categoria.products.length, 5)
    assert.deepEqual(
      categoria.products.map((item) => item.quantity),
      [80, 70, 60, 50, 40],
      'os cinco maiores, em ordem decrescente',
    )
    assert.equal(categoria.otherProductsCount, 3, 'os 3 restantes com saldo')
  })

  test('soma por unidade nunca mistura unidades diferentes', async () => {
    const suffix = 'cat-unidades'
    const tenant = await createTenant(suffix, '0')
    const [caixa] = await db
      .insert(units)
      .values({ companyId: tenant.companyId, name: 'Caixa', abbreviation: 'cx', createdBy: tenant.admin.id })
      .returning({ id: units.id })

    const criados = await criarProdutos(tenant, [
      { name: 'Em quilos', stock: '7' },
      { name: 'Em caixas', stock: '3' },
    ])
    await db.update(products).set({ unitId: caixa.id }).where(eq(products.id, criados[1].id))

    const { stockByCategory } = await resumo(tenant)
    const categoria = stockByCategory.find((item) => item.categoryName.startsWith('Categoria'))
    assert.ok(categoria)

    const porUnidade = [...categoria.totalsByUnit].sort((a, b) => a.unitAbbreviation.localeCompare(b.unitAbbreviation))
    assert.equal(porUnidade.length, 2)
    assert.deepEqual(porUnidade.map((item) => [item.unitAbbreviation, item.quantity]), [
      ['cx', 3],
      [`u${suffix}`, 7],
    ])
  })
})

describe('perdas por motivo no painel', () => {
  test('agrupa por motivo, corta os 5 maiores e conta a sobra', async () => {
    const tenant = await createTenant('perdas-top-n', '0')
    const criados = await criarProdutos(
      tenant,
      Array.from({ length: 7 }, (_, index) => ({
        name: `Perdido ${String(index + 1).padStart(2, '0')}`,
        stock: '1000',
      })),
    )

    for (const [index, produto] of criados.entries()) {
      await createLoss(tenant.companyId, tenant.operator.id, {
        productId: produto.id,
        quantity: (index + 1) * 10,
        reason: 'avariado',
      })
    }

    const { lossesByReason } = await resumo(tenant)
    const avariado = lossesByReason.find((item) => item.reason === 'avariado')
    assert.ok(avariado)

    assert.equal(avariado.lossesCount, 7, 'a contagem considera todas as perdas do motivo')
    assert.equal(avariado.totalsByUnit[0].quantity, 280, '10+20+...+70')
    assert.deepEqual(
      avariado.products.map((item) => item.quantity),
      [70, 60, 50, 40, 30],
      'os cinco maiores, em ordem decrescente',
    )
    assert.equal(avariado.otherProductsCount, 2)
  })

  test('motivos diferentes não se misturam', async () => {
    const tenant = await createTenant('perdas-motivos', '500')

    await createLoss(tenant.companyId, tenant.operator.id, {
      productId: tenant.productId,
      quantity: 3,
      reason: 'vencido',
    })
    await createLoss(tenant.companyId, tenant.operator.id, {
      productId: tenant.productId,
      quantity: 8,
      reason: 'roubo_furto',
    })

    const { lossesByReason } = await resumo(tenant)
    const porMotivo = Object.fromEntries(
      lossesByReason.map((item) => [item.reason, item.totalsByUnit[0]?.quantity ?? 0]),
    )

    assert.equal(porMotivo.vencido, 3)
    assert.equal(porMotivo.roubo_furto, 8)
    assert.equal(lossesByReason.length, 2, 'motivo sem perda no período não aparece')
  })
})
