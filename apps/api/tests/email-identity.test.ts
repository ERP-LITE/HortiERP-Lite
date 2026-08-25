import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { companies, users } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

const SENHA = 'senha-forte-123'

async function criarEmpresaComAdmin(nome: string, email: string) {
  const [company] = await db.insert(companies).values({ name: nome }).returning({ id: companies.id })
  const passwordHash = await bcrypt.hash(SENHA, 10)
  const [user] = await db
    .insert(users)
    .values({ companyId: company.id, name: 'Admin', email, passwordHash, role: 'admin' })
    .returning({ id: users.id })
  return { companyId: company.id, userId: user.id }
}

function login(email: string, password = SENHA) {
  return ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
}

describe('identidade de e-mail insensível à caixa', () => {
  test('entra digitando o e-mail em qualquer caixa', async () => {
    await criarEmpresaComAdmin('Loja da Maria', 'maria@loja.com')

    for (const digitado of ['maria@loja.com', 'Maria@Loja.com', 'MARIA@LOJA.COM', '  Maria@Loja.Com  ']) {
      const resposta = await login(digitado)
      assert.equal(resposta.statusCode, 200, `deveria entrar digitando "${digitado}"`)
    }
  })

  test('senha errada continua sendo recusada', async () => {
    await criarEmpresaComAdmin('Loja do João', 'joao@loja.com')

    const resposta = await login('JOAO@LOJA.COM', 'senha-errada')
    assert.equal(resposta.statusCode, 401)
  })

  test('grava o e-mail em minúsculas ao cadastrar usuário pela API', async () => {
    const tenant = await createTenant('email-caixa')

    const resposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { name: 'Funcionária', email: 'Funcionaria@Loja.COM', password: SENHA, role: 'operador' },
    })

    assert.equal(resposta.statusCode, 201)
    assert.equal(resposta.json<{ email: string }>().email, 'funcionaria@loja.com')
  })

  test('recusa cadastro que só difere pela caixa do e-mail', async () => {
    const tenant = await createTenant('email-duplicado')
    const criar = (email: string) =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { cookie: authCookie(ctx.app, tenant.admin) },
        payload: { name: 'Alguém', email, password: SENHA, role: 'operador' },
      })

    assert.equal((await criar('repetido@loja.com')).statusCode, 201)
    assert.equal((await criar('REPETIDO@loja.com')).statusCode, 409)
  })

  test('o índice do banco barra a duplicidade por caixa mesmo em requisições simultâneas', async () => {
    const tenant = await createTenant('email-corrida')
    const criar = (email: string) =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { cookie: authCookie(ctx.app, tenant.admin) },
        payload: { name: 'Alguém', email, password: SENHA, role: 'operador' },
      })

    const respostas = await Promise.all([criar('corrida@loja.com'), criar('CORRIDA@LOJA.COM')])
    assert.deepEqual(
      respostas.map(({ statusCode }) => statusCode).sort(),
      [201, 409],
      'exatamente uma das duas deve ser aceita',
    )
  })
})

describe('reaproveitamento de e-mail de usuário excluído', () => {
  test('recontratar usa o mesmo e-mail de novo', async () => {
    const tenant = await createTenant('recontratacao')
    const cookie = authCookie(ctx.app, tenant.admin)
    const payload = { name: 'Funcionário', email: 'funcionario@loja.com', password: SENHA, role: 'operador' as const }

    const criado = await ctx.app.inject({ method: 'POST', url: '/api/users', headers: { cookie }, payload })
    assert.equal(criado.statusCode, 201)
    const criadoId = criado.json<{ id: string }>().id

    const excluido = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/users/${criadoId}`,
      headers: { cookie },
    })
    assert.equal(excluido.statusCode, 204)

    const recontratado = await ctx.app.inject({ method: 'POST', url: '/api/users', headers: { cookie }, payload })
    assert.equal(recontratado.statusCode, 201, 'o e-mail do excluído tem que voltar a ficar livre')
    assert.notEqual(recontratado.json<{ id: string }>().id, criadoId)
  })

  test('o usuário excluído não consegue mais entrar, mesmo com o e-mail reaproveitado', async () => {
    const { userId } = await criarEmpresaComAdmin('Loja da Ana', 'ana@loja.com')
    await db.update(users).set({ deletedAt: new Date(), active: false }).where(eq(users.id, userId))

    const resposta = await login('ana@loja.com')
    assert.equal(resposta.statusCode, 401)
  })
})
