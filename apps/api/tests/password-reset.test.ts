import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from './db.js'
import { activityLogs, companies, passwordResetTokens, users } from '../src/db/schema/index.js'
import { buildApp } from '../src/app.js'
import { authCookie, setupTestApp } from './helpers.js'

// Sem o limitador: ele é por IP e `app.inject` faz o arquivo inteiro chegar do mesmo endereço, então
// as janelas longas destas rotas esgotariam a cota no meio da suíte. O freio tem teste próprio, lá
// embaixo, com uma instância que o mantém ligado.
const ctx = setupTestApp({ rateLimit: false })

const SENHA = 'senha-antiga-123'
const SENHA_NOVA = 'senha-nova-456'

/**
 * Nenhum teste lê o token do e-mail, porque nenhum e-mail sai aqui (sem `RESEND_API_KEY` o envio vai
 * para o log). O que o token faz no banco é o que interessa, e a linha só guarda o SHA-256 dele:
 * gerar o hash a partir de um candidato é como o serviço encontra o pedido, então é assim que o
 * teste também encontra.
 */
function hashDoToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function criarConta(sufixo: string, extras: { active?: boolean; role?: 'admin' | 'super_admin' } = {}) {
  const [company] = await db
    .insert(companies)
    .values({ name: `Empresa ${sufixo}` })
    .returning({ id: companies.id })
  const [user] = await db
    .insert(users)
    .values({
      companyId: company.id,
      name: `Pessoa ${sufixo}`,
      email: `${sufixo}@test.local`,
      passwordHash: await bcrypt.hash(SENHA, 10),
      role: extras.role ?? 'admin',
      active: extras.active ?? true,
    })
    .returning({ id: users.id, companyId: users.companyId, email: users.email })

  return user
}

function pedirRedefinicao(email: string) {
  return ctx.app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email } })
}

function redefinir(token: string, newPassword = SENHA_NOVA) {
  return ctx.app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, newPassword } })
}

function entrar(email: string, password: string) {
  return ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
}

/**
 * O token em claro só existe dentro do e-mail. Para o teste conseguir clicar no link, ele grava um
 * token conhecido direto na tabela, com o mesmo formato que o serviço grava.
 */
async function plantarToken(
  user: { id: string; companyId: string },
  token: string,
  opcoes: { expiraEm?: Date; usadoEm?: Date } = {},
) {
  await db.insert(passwordResetTokens).values({
    companyId: user.companyId,
    userId: user.id,
    tokenHash: hashDoToken(token),
    expiresAt: opcoes.expiraEm ?? new Date(Date.now() + 60 * 60 * 1000),
    usedAt: opcoes.usadoEm,
  })
}

describe('pedido de redefinição de senha', () => {
  test('conta existente ganha um pedido guardado como hash, nunca o token em claro', async () => {
    const user = await criarConta('pedido-ok')

    const resposta = await pedirRedefinicao(user.email)
    assert.equal(resposta.statusCode, 200)

    const pedidos = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id))
    assert.equal(pedidos.length, 1)
    assert.equal(pedidos[0].tokenHash.length, 64)
    assert.equal(pedidos[0].companyId, user.companyId)
    assert.equal(pedidos[0].usedAt, null)
    assert.ok(pedidos[0].expiresAt > new Date())
  })

  test('e-mail sem conta responde igual ao e-mail com conta e não cria pedido', async () => {
    const user = await criarConta('pedido-comparado')

    const comConta = await pedirRedefinicao(user.email)
    const semConta = await pedirRedefinicao('ninguem-por-aqui@test.local')

    assert.equal(semConta.statusCode, comConta.statusCode)
    assert.deepEqual(semConta.json(), comConta.json())

    const pedidos = await db.select().from(passwordResetTokens)
    assert.equal(pedidos.length, 1, 'só a conta que existe gera pedido')
  })

  test('conta desativada responde igual e não gera pedido', async () => {
    const user = await criarConta('pedido-inativo', { active: false })

    const resposta = await pedirRedefinicao(user.email)

    assert.equal(resposta.statusCode, 200)
    const pedidos = await db.select().from(passwordResetTokens)
    assert.equal(pedidos.length, 0)
  })

  test('conta de plataforma não entra no fluxo por e-mail, e a resposta não denuncia isso', async () => {
    const superAdmin = await criarConta('pedido-super', { role: 'super_admin' })
    const comum = await criarConta('pedido-comum')

    const doSuper = await pedirRedefinicao(superAdmin.email)
    const doComum = await pedirRedefinicao(comum.email)

    // A recusa não pode aparecer na resposta: seria um jeito de descobrir quais e-mails são da
    // plataforma, que é justamente a conta que mais interessa a quem ataca.
    assert.equal(doSuper.statusCode, doComum.statusCode)
    assert.deepEqual(doSuper.json(), doComum.json())

    const pedidos = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, superAdmin.id))
    assert.equal(pedidos.length, 0, 'super admin não pode ganhar link de redefinição')
  })

  test('pedido repetido em seguida não vira um segundo token', async () => {
    const user = await criarConta('pedido-repetido')

    await pedirRedefinicao(user.email)
    const segundo = await pedirRedefinicao(user.email)

    assert.equal(segundo.statusCode, 200, 'a carência não pode aparecer na resposta')
    const pedidos = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id))
    assert.equal(pedidos.length, 1)
  })
})

describe('uso do link de redefinição', () => {
  test('token válido grava a senha nova e a antiga para de valer', async () => {
    const user = await criarConta('uso-ok')
    await plantarToken(user, 'token-valido-1')

    const resposta = await redefinir('token-valido-1')
    assert.equal(resposta.statusCode, 200)

    assert.equal((await entrar(user.email, SENHA_NOVA)).statusCode, 200)
    assert.equal((await entrar(user.email, SENHA)).statusCode, 401)
  })

  test('redefinir marca `passwordChangedAt` e derruba sessão aberta com a senha antiga', async () => {
    const user = await criarConta('uso-derruba')

    // `iat` no passado, igual ao teste da troca de senha: o token emitido no mesmo segundo da
    // redefinição cai na tolerância de 1 segundo da checagem e sobreviveria de propósito.
    const cookie = authCookie(ctx.app, { id: user.id, companyId: user.companyId, role: 'admin' }, {
      emitidoHaSegundos: 60,
    })
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode, 200)

    await plantarToken(user, 'token-valido-2')
    assert.equal((await redefinir('token-valido-2')).statusCode, 200)

    const depois = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    assert.equal(depois.statusCode, 401)

    const [gravado] = await db
      .select({ passwordChangedAt: users.passwordChangedAt })
      .from(users)
      .where(eq(users.id, user.id))
    assert.ok(gravado.passwordChangedAt)
  })

  test('o mesmo token não serve duas vezes', async () => {
    const user = await criarConta('uso-unico')
    await plantarToken(user, 'token-uma-vez')

    assert.equal((await redefinir('token-uma-vez')).statusCode, 200)

    const segunda = await redefinir('token-uma-vez', 'outra-senha-789')
    assert.equal(segunda.statusCode, 400)
    assert.equal((await entrar(user.email, 'outra-senha-789')).statusCode, 401)
  })

  test('usar um link invalida os outros pedidos em aberto da mesma pessoa', async () => {
    const user = await criarConta('uso-invalida-irmaos')
    await plantarToken(user, 'token-irmao-a')
    await plantarToken(user, 'token-irmao-b')

    assert.equal((await redefinir('token-irmao-a')).statusCode, 200)

    const emAberto = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)))
    assert.equal(emAberto.length, 0)
    assert.equal((await redefinir('token-irmao-b', 'terceira-senha-000')).statusCode, 400)
  })

  test('token de super admin emitido antes da regra não redefine nada', async () => {
    const superAdmin = await criarConta('uso-super-antigo', { role: 'super_admin' })
    await plantarToken(superAdmin, 'token-super-antigo')

    assert.equal((await redefinir('token-super-antigo')).statusCode, 400)
    assert.equal((await entrar(superAdmin.email, SENHA)).statusCode, 200, 'a senha antiga continua valendo')
  })

  test('redefinir deixa rastro com nome no histórico de atividades', async () => {
    const user = await criarConta('uso-rastro')
    await plantarToken(user, 'token-rastro')

    assert.equal((await redefinir('token-rastro')).statusCode, 200)

    const registros = await db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.entity, 'usuario'), eq(activityLogs.entityId, user.id)))

    assert.equal(registros.length, 1)
    assert.equal(registros[0].action, 'alterou')
    assert.equal(registros[0].actorId, user.id)
    assert.equal(registros[0].companyId, user.companyId)
    // O log técnico registra o caminho e o IP, mas não a conta: sem este registro a redefinição
    // ficaria sem nenhum rastro ligado a um nome.
    assert.ok(registros[0].entityLabel.length > 0)
  })

  test('token vencido não redefine', async () => {
    const user = await criarConta('uso-vencido')
    await plantarToken(user, 'token-vencido', { expiraEm: new Date(Date.now() - 1000) })

    assert.equal((await redefinir('token-vencido')).statusCode, 400)
    assert.equal((await entrar(user.email, SENHA)).statusCode, 200, 'a senha antiga continua valendo')
  })

  test('token inexistente não redefine', async () => {
    const resposta = await redefinir('token-que-nunca-existiu')
    assert.equal(resposta.statusCode, 400)
  })

  test('as três recusas usam exatamente a mesma frase', async () => {
    const user = await criarConta('uso-mesma-frase')
    await plantarToken(user, 'token-gasto', { usadoEm: new Date() })
    await plantarToken(user, 'token-morto', { expiraEm: new Date(Date.now() - 1000) })

    const mensagens = await Promise.all(
      ['token-gasto', 'token-morto', 'token-inexistente'].map(async (token) =>
        (await redefinir(token)).json<{ error: { message: string } }>().error.message,
      ),
    )

    assert.equal(new Set(mensagens).size, 1, `recusas diferentes entregam o estado do token: ${mensagens.join(' | ')}`)
  })

  test('conta desativada depois do pedido não é reaberta pelo link', async () => {
    const user = await criarConta('uso-desativado-depois')
    await plantarToken(user, 'token-conta-morta')
    await db.update(users).set({ active: false }).where(eq(users.id, user.id))

    assert.equal((await redefinir('token-conta-morta')).statusCode, 400)
  })

  test('senha curta é recusada com a mesma regra do resto do sistema', async () => {
    const user = await criarConta('uso-senha-curta')
    await plantarToken(user, 'token-senha-curta')

    const resposta = await redefinir('token-senha-curta', 'curta')
    assert.equal(resposta.statusCode, 422)
  })
})

describe('freio de tentativas das rotas de senha', () => {
  test('pedir redefinição muitas vezes seguidas para de ser aceito', async () => {
    const app = buildApp({ systemLogs: false })
    await app.ready()

    try {
      const codigos: number[] = []
      for (let tentativa = 0; tentativa < 8; tentativa += 1) {
        const resposta = await app.inject({
          method: 'POST',
          url: '/api/auth/forgot-password',
          payload: { email: `rajada-${tentativa}@test.local` },
        })
        codigos.push(resposta.statusCode)
      }

      assert.ok(codigos.includes(429), `o limitador deveria ter barrado alguma tentativa: ${codigos.join(', ')}`)
    } finally {
      await app.close()
    }
  })
})
