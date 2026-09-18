import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { registerResourceParams } from '../src/shared/middlewares/resourceParams.js'
import { errorHandler } from '../src/shared/middlewares/errorHandler.js'
import { AppError } from '../src/shared/errors/AppError.js'

test('parâmetros inválidos não chegam ao serviço e não escondem erros internos do banco', async (t) => {
  const app = Fastify()
  t.after(() => app.close())
  app.setErrorHandler(errorHandler)
  registerResourceParams(app)
  let chamadas = 0
  app.get('/resources/:id/items/:productId', async () => { chamadas += 1; return { ok: true } })
  app.delete('/resources/:id', { preHandler: async () => { throw AppError.forbidden('Sem permissão') } }, async () => ({}))
  app.get('/address/:cep', async () => ({ ok: true }))
  app.get('/database-error', async () => {
    throw Object.assign(new Error('invalid input syntax for type integer'), { code: '22P02' })
  })
  const id = '123e4567-e89b-12d3-a456-426614174000'
  for (const url of [`/resources/abc/items/${id}`, `/resources/${id}/items/abc`]) {
    assert.equal((await app.inject(url)).statusCode, 404)
  }
  assert.equal(chamadas, 0)
  assert.equal((await app.inject(`/resources/${id}/items/${id}`)).statusCode, 200)
  assert.equal(chamadas, 1)
  assert.equal((await app.inject({ method: 'DELETE', url: '/resources/abc' })).statusCode, 403)
  assert.equal((await app.inject('/address/12345678')).statusCode, 200)
  const erro = await app.inject('/database-error')
  assert.equal(erro.statusCode, 500)
  assert.equal(erro.json().error.message, 'Erro interno do servidor')
})
