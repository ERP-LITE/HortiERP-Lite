import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { LIMITES_NUMERO, LIMITES_TEXTO, SENHA_MAX_BYTES } from '../src/shared/schemas/limits.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

function issues(response: { json: <T>() => T }) {
  return response.json<{ error: { issues?: Record<string, string[]> } }>().error.issues ?? {}
}

function repetir(tamanho: number) {
  return 'a'.repeat(tamanho)
}

describe('limites de tamanho dos campos', () => {
  test('quantidade acima da precisão da coluna é recusada com mensagem, não com erro interno', async () => {
    const tenant = await createTenant('limite-quantidade')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { productId: tenant.productId, quantity: 342342342342342342300000000000000, reason: 'outro' },
    })

    assert.equal(response.statusCode, 422)
    assert.match(issues(response).quantity?.[0] ?? '', /menor ou igual a/)
  })

  test('abreviação longa demais responde em português', async () => {
    const tenant = await createTenant('limite-abreviacao')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/units',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { name: 'Unidade nova', abbreviation: repetir(LIMITES_TEXTO.abreviacao + 1) },
    })

    assert.equal(response.statusCode, 422)
    assert.equal(issues(response).abbreviation?.[0], `Use no máximo ${LIMITES_TEXTO.abreviacao} caracteres`)
  })

  test('nome de produto acima do limite é recusado', async () => {
    const tenant = await createTenant('limite-nome')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: {
        categoryId: tenant.categoryId,
        unitId: tenant.unitId,
        name: repetir(LIMITES_TEXTO.nome + 1),
      },
    })

    assert.equal(response.statusCode, 422)
    assert.equal(issues(response).name?.[0], `Use no máximo ${LIMITES_TEXTO.nome} caracteres`)
  })

  test('observação da perda acima do limite é recusada', async () => {
    const tenant = await createTenant('limite-observacao')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: {
        productId: tenant.productId,
        quantity: 1,
        reason: 'outro',
        notes: repetir(LIMITES_TEXTO.observacoes + 1),
      },
    })

    assert.equal(response.statusCode, 422)
    assert.equal(issues(response).notes?.[0], `Use no máximo ${LIMITES_TEXTO.observacoes} caracteres`)
  })

  test('senha além do que o bcrypt considera é recusada no cadastro de usuário', async () => {
    const tenant = await createTenant('limite-senha')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: {
        name: 'Usuário novo',
        email: 'usuario-senha-longa@test.local',
        password: repetir(SENHA_MAX_BYTES + 1),
        role: 'operador',
      },
    })

    assert.equal(response.statusCode, 422)
    assert.match(issues(response).password?.[0] ?? '', /Senha muito longa/)
  })

  test('custo unitário acima do limite da entrada é recusado', async () => {
    const tenant = await createTenant('limite-custo')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: {
        items: [{ productId: tenant.productId, quantity: 1, unitCost: LIMITES_NUMERO.valorUnitario + 1 }],
      },
    })

    assert.equal(response.statusCode, 422)
    assert.ok(Object.keys(issues(response)).length > 0)
  })

  test('busca longa demais é recusada em vez de virar consulta gigante', async () => {
    const tenant = await createTenant('limite-busca')

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/products?search=${repetir(LIMITES_TEXTO.busca + 1)}`,
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
    })

    assert.equal(response.statusCode, 422)
    assert.equal(issues(response).search?.[0], `Use no máximo ${LIMITES_TEXTO.busca} caracteres`)
  })
})

describe('mensagens de validação do Zod em português', () => {
  test('campo obrigatório ausente responde em português', async () => {
    const tenant = await createTenant('zod-obrigatorio')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/units',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { abbreviation: 'kg' },
    })

    assert.equal(response.statusCode, 422)
    assert.equal(issues(response).name?.[0], 'Campo obrigatório')
  })

  test('opção fora da lista responde em português', async () => {
    const tenant = await createTenant('zod-enum')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { productId: tenant.productId, quantity: 1, reason: 'motivo-inexistente' },
    })

    assert.equal(response.statusCode, 422)
    assert.equal(issues(response).reason?.[0], 'Selecione uma das opções disponíveis')
  })

  test('identificador que não é UUID responde em português', async () => {
    const tenant = await createTenant('zod-uuid')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { productId: 'nao-e-uuid', quantity: 1, reason: 'outro' },
    })

    assert.equal(response.statusCode, 422)
    assert.equal(issues(response).productId?.[0], 'Produto inválido')
  })

  test('nenhuma mensagem de validação sai em inglês', async () => {
    const tenant = await createTenant('zod-sem-ingles')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/units',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { name: repetir(LIMITES_TEXTO.nome + 1), abbreviation: repetir(LIMITES_TEXTO.abreviacao + 1) },
    })

    const mensagens = Object.values(issues(response)).flat().join(' ')
    assert.doesNotMatch(mensagens, /String|Number|Required|must contain|Invalid/i)
  })
})
