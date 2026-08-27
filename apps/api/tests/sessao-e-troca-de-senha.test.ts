import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { db } from './db.js'
import { companies, users } from '../src/db/schema/index.js'
import { setupTestApp } from './helpers.js'

const ctx = setupTestApp()

const SENHA = 'senha-forte-123'
const SENHA_NOVA = 'senha-nova-456'

async function criarAdmin(email: string) {
  const [company] = await db.insert(companies).values({ name: `Empresa de ${email}` }).returning({ id: companies.id })
  const [user] = await db
    .insert(users)
    .values({
      companyId: company.id,
      name: 'Admin',
      email,
      passwordHash: await bcrypt.hash(SENHA, 10),
      role: 'admin',
    })
    .returning({ id: users.id, companyId: users.companyId, role: users.role })
  return user
}

/** Token com `iat` no passado: o de agora cai na tolerância de 1 segundo da checagem. */
function cookieAntigo(user: { id: string; companyId: string; role: string }) {
  const token = ctx.app.jwt.sign({
    sub: user.id,
    companyId: user.companyId,
    role: user.role as 'admin' | 'super_admin',
    iat: Math.floor(Date.now() / 1000) - 60,
  })
  return `token=${token}`
}

function cookieDaResposta(response: { cookies: Array<{ name: string; value: string }> }) {
  const cookie = response.cookies.find(({ name }) => name === 'token')
  assert.ok(cookie, 'a resposta não trouxe cookie de sessão')
  return `token=${cookie.value}`
}

function euSou(cookie: string) {
  return ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
}

describe('troca de senha encerra as sessões antigas', () => {
  test('token emitido antes da troca deixa de valer', async () => {
    const user = await criarAdmin('admin-troca@test.local')
    const antigo = cookieAntigo(user)

    assert.equal((await euSou(antigo)).statusCode, 200)

    const troca = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/auth/password',
      headers: { cookie: antigo },
      payload: { currentPassword: SENHA, newPassword: SENHA_NOVA },
    })

    assert.equal(troca.statusCode, 200)
    assert.equal((await euSou(antigo)).statusCode, 401)
  })

  test('quem trocou a senha continua conectado, com o cookie novo', async () => {
    const user = await criarAdmin('admin-segue@test.local')

    const troca = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/auth/password',
      headers: { cookie: cookieAntigo(user) },
      payload: { currentPassword: SENHA, newPassword: SENHA_NOVA },
    })

    assert.equal((await euSou(cookieDaResposta(troca))).statusCode, 200)
  })

  test('senha redefinida pelo admin encerra a sessão do usuário afetado', async () => {
    const admin = await criarAdmin('admin-reset@test.local')
    const [alvo] = await db
      .insert(users)
      .values({
        companyId: admin.companyId,
        name: 'Operador',
        email: 'operador-reset@test.local',
        passwordHash: await bcrypt.hash(SENHA, 10),
        role: 'operador',
      })
      .returning({ id: users.id, companyId: users.companyId, role: users.role })

    const cookieDoAlvo = cookieAntigo(alvo)
    assert.equal((await euSou(cookieDoAlvo)).statusCode, 200)

    const reset = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${alvo.id}`,
      headers: { cookie: cookieAntigo(admin) },
      payload: { password: SENHA_NOVA },
    })

    assert.equal(reset.statusCode, 200)
    assert.equal((await euSou(cookieDoAlvo)).statusCode, 401)
    // O admin que redefiniu não é afetado.
    assert.equal((await euSou(cookieAntigo(admin))).statusCode, 200)
  })

  // O caso que passou batido: o usuário pode trocar a própria senha editando o próprio registro na
  // tela de usuários, não só na tela de perfil. Essa rota também grava `password_changed_at`.
  test('trocar a própria senha pela tela de usuários também reemite o cookie', async () => {
    const admin = await criarAdmin('admin-auto-edicao@test.local')

    const resposta = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${admin.id}`,
      headers: { cookie: cookieAntigo(admin) },
      payload: { password: SENHA_NOVA },
    })

    assert.equal(resposta.statusCode, 200)
    assert.equal((await euSou(cookieDaResposta(resposta))).statusCode, 200)
  })

  test('trocar a própria senha na tela de super administradores também reemite o cookie', async () => {
    const [plataforma] = await db.insert(companies).values({ name: 'Plataforma Teste' }).returning({ id: companies.id })
    const [superAdmin] = await db
      .insert(users)
      .values({
        companyId: plataforma.id,
        name: 'Super',
        email: 'super-auto-edicao@test.local',
        passwordHash: await bcrypt.hash(SENHA, 10),
        role: 'super_admin',
      })
      .returning({ id: users.id, companyId: users.companyId, role: users.role })

    const resposta = await ctx.app.inject({
      method: 'PUT',
      url: `/api/platform-users/${superAdmin.id}`,
      headers: { cookie: cookieAntigo(superAdmin) },
      payload: { name: 'Super', email: 'super-auto-edicao@test.local', password: SENHA_NOVA },
    })

    assert.equal(resposta.statusCode, 200)
    assert.equal((await euSou(cookieDaResposta(resposta))).statusCode, 200)
  })

  test('senha nunca trocada não derruba sessão nenhuma', async () => {
    const user = await criarAdmin('admin-intacto@test.local')

    assert.equal((await euSou(cookieAntigo(user))).statusCode, 200)
  })
})
