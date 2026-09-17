import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { authCookie, createTenant, setupTestApp, type TenantFixture } from './helpers.js'

const ctx = setupTestApp()

type Precificacao = {
  currentMargin: number | null
  effectiveTargetMargin: number | null
  targetMarginInherited: boolean
  suggestedPrice: number | null
}

function criarProduto(tenant: TenantFixture, body: Record<string, unknown>) {
  return ctx.app.inject({
    method: 'POST',
    url: '/api/products',
    headers: { cookie: authCookie(ctx.app, tenant.admin) },
    payload: { categoryId: tenant.categoryId, unitId: tenant.unitId, ...body },
  })
}

function alterarCategoria(tenant: TenantFixture, body: Record<string, unknown>) {
  return ctx.app.inject({
    method: 'PUT',
    url: `/api/categories/${tenant.categoryId}`,
    headers: { cookie: authCookie(ctx.app, tenant.admin) },
    payload: body,
  })
}

async function precificacao(tenant: TenantFixture, produtoId: string) {
  const response = await ctx.app.inject({
    method: 'GET',
    url: `/api/products/${produtoId}`,
    headers: { cookie: authCookie(ctx.app, tenant.admin) },
  })
  assert.equal(response.statusCode, 200)
  return response.json<Precificacao>()
}

describe('margem praticada', () => {
  test('sai do custo e do preço de venda cadastrados', async () => {
    const tenant = await createTenant('margem-atual')
    const criado = await criarProduto(tenant, { name: 'Tomate', costPrice: 6, salePrice: 10 })
    assert.equal(criado.statusCode, 201)

    const { currentMargin } = await precificacao(tenant, criado.json<{ id: string }>().id)
    assert.equal(currentMargin, 40)
  })

  test('sem preço de venda não existe margem a calcular', async () => {
    const tenant = await createTenant('margem-sem-venda')
    const criado = await criarProduto(tenant, { name: 'Alface', costPrice: 3 })

    const { currentMargin } = await precificacao(tenant, criado.json<{ id: string }>().id)
    assert.equal(currentMargin, null)
  })

  test('vender abaixo do custo devolve margem negativa em vez de esconder', async () => {
    const tenant = await createTenant('margem-negativa')
    const criado = await criarProduto(tenant, { name: 'Banana', costPrice: 10, salePrice: 8 })

    const { currentMargin } = await precificacao(tenant, criado.json<{ id: string }>().id)
    assert.equal(currentMargin, -25)
  })
})

describe('preço sugerido', () => {
  test('a margem é sobre a venda, não sobre o custo', async () => {
    const tenant = await createTenant('margem-sobre-venda')
    const criado = await criarProduto(tenant, { name: 'Cenoura', costPrice: 10, targetMargin: 40 })

    const { suggestedPrice } = await precificacao(tenant, criado.json<{ id: string }>().id)
    // Markup de 40% daria 14,00, que é o erro clássico dessa conta.
    assert.equal(suggestedPrice, 16.67)
  })

  test('herda a margem da categoria quando o produto não tem a sua', async () => {
    const tenant = await createTenant('margem-herdada')
    assert.equal((await alterarCategoria(tenant, { targetMargin: 50 })).statusCode, 200)
    const criado = await criarProduto(tenant, { name: 'Batata', costPrice: 10 })

    const resultado = await precificacao(tenant, criado.json<{ id: string }>().id)
    assert.equal(resultado.effectiveTargetMargin, 50)
    assert.equal(resultado.targetMarginInherited, true)
    assert.equal(resultado.suggestedPrice, 20)
  })

  test('a margem do produto manda sobre a da categoria', async () => {
    const tenant = await createTenant('margem-do-produto')
    await alterarCategoria(tenant, { targetMargin: 50 })
    const criado = await criarProduto(tenant, { name: 'Maçã', costPrice: 10, targetMargin: 20 })

    const resultado = await precificacao(tenant, criado.json<{ id: string }>().id)
    assert.equal(resultado.effectiveTargetMargin, 20)
    assert.equal(resultado.targetMarginInherited, false)
    assert.equal(resultado.suggestedPrice, 12.5)
  })

  test('sem custo cadastrado não dá para sugerir preço', async () => {
    const tenant = await createTenant('margem-sem-custo')
    const criado = await criarProduto(tenant, { name: 'Uva', targetMargin: 40 })

    const resultado = await precificacao(tenant, criado.json<{ id: string }>().id)
    assert.equal(resultado.effectiveTargetMargin, 40)
    assert.equal(resultado.suggestedPrice, null)
  })

  test('margem de 100% ou mais é recusada', async () => {
    const tenant = await createTenant('margem-impossivel')
    const resposta = await criarProduto(tenant, { name: 'Melancia', costPrice: 10, targetMargin: 100 })

    assert.equal(resposta.statusCode, 422)
    const problemas = resposta.json<{ error: { issues?: Record<string, string[]> } }>().error.issues ?? {}
    assert.match(problemas.targetMargin?.[0] ?? '', /menor que 100/)
  })
})
