import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { env } from '../src/shared/config/env.js'
import { createStockEntry } from '../src/modules/stock-entries/stock-entries.service.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

function errorPayload(response: { json: <T>() => T }) {
  return response.json<{ error: { code: string; message: string } }>().error
}

describe('mensagens de erro do framework em português', () => {
  test('endereço inexistente responde no envelope da API e em português', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/nao-existe' })

    assert.equal(response.statusCode, 404)
    const error = errorPayload(response)
    assert.equal(error.code, 'NOT_FOUND')
    assert.equal(error.message, 'Endereço não encontrado')
  })

  test('content-type não suportado responde em português', async () => {
    const tenant = await createTenant('content-type')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: {
        cookie: authCookie(ctx.app, tenant.admin),
        'content-type': 'application/x-www-form-urlencoded',
      },
      payload: 'name=Categoria+Nova',
    })

    assert.equal(response.statusCode, 415)
    const error = errorPayload(response)
    assert.equal(error.message, 'Formato de conteúdo não suportado nesta operação')
  })

  test('corpo JSON ilegível responde em português', async () => {
    const tenant = await createTenant('json-quebrado')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { cookie: authCookie(ctx.app, tenant.admin), 'content-type': 'application/json' },
      payload: '{"name": ',
    })

    assert.equal(response.statusCode, 400)
    assert.equal(errorPayload(response).message, 'Não foi possível ler os dados enviados')
  })

  test('arquivo maior que o limite responde em português com o limite em MB', async () => {
    const tenant = await createTenant('anexo-grande')
    const entry = await createStockEntry(tenant.companyId, tenant.operator.id, {
      items: [{ productId: tenant.productId, quantity: 1 }],
    })

    const boundary = '----hortierp-arquivo-grande'
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const excedente = Buffer.alloc(env.INVOICE_MAX_FILE_SIZE + 1024, 0)
    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="danfe.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      pngHeader,
      excedente,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/stock-entries/${entry.id}/attachments`,
      headers: {
        cookie: authCookie(ctx.app, tenant.operator),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartBody,
    })

    assert.equal(response.statusCode, 413)
    const megabytes = Math.floor(env.INVOICE_MAX_FILE_SIZE / 1024 / 1024)
    assert.equal(errorPayload(response).message, `O arquivo excede o limite de ${megabytes} MB`)
  })

  // Consome a cota de login do arquivo: qualquer teste posterior que chame /api/auth/login levaria 429.
  test('excesso de tentativas de login responde em português com o tempo de espera', async () => {
    let limitada: Awaited<ReturnType<typeof ctx.app.inject>> | undefined
    for (let tentativa = 0; tentativa < 12 && !limitada; tentativa += 1) {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'ninguem@test.local', password: 'senha-errada-mesmo' },
      })
      if (response.statusCode === 429) limitada = response
    }

    assert.ok(limitada, 'o limitador deveria ter respondido 429 dentro das 12 tentativas')
    const error = errorPayload(limitada)
    assert.equal(error.code, 'RATE_LIMITED')
    assert.match(
      error.message,
      /^Muitas tentativas em pouco tempo\. Tente novamente em \d+ (segundo|segundos|minuto|minutos)\.$/,
    )
  })
})
