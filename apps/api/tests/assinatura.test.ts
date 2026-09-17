import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { companies, plans } from '../src/db/schema/index.js'
import { avaliarAssinatura } from '../src/modules/subscriptions/subscriptions.service.js'
import { addDaysToIsoDate, todayIsoDate } from '../src/shared/utils/date.js'
import { db } from './db.js'
import { buildApp } from '../src/app.js'
import { authCookie, createTenant, createUser, setupTestApp } from './helpers.js'

// O freio fica desligado aqui porque o arquivo faz vários cadastros seguidos e o limite é de 5 por
// hora; o próprio freio é testado no fim, num app à parte.
const ctx = setupTestApp({ rateLimit: false })

async function planoSemeado() {
  const [plano] = await db.select({ id: plans.id, trialDays: plans.trialDays }).from(plans).limit(1)
  return plano
}

function corpoDoCadastro(planId: string, sufixo: string) {
  return {
    planId,
    name: `Hortifruti ${sufixo}`,
    legalName: `Hortifruti ${sufixo} LTDA`,
    // CNPJ válido pelo módulo 11, necessário porque o schema recusa dígito verificador errado.
    document: '11222333000181',
    contactName: 'Responsável',
    contactEmail: `contato-${sufixo}@teste.local`,
    phone: '11999998888',
    postalCode: '01001000',
    street: 'Praça da Sé',
    addressNumber: '1',
    district: 'Sé',
    city: 'São Paulo',
    state: 'SP',
    adminName: 'Dono da Loja',
    adminEmail: `dono-${sufixo}@teste.local`,
    adminPassword: 'senha-bem-forte-123',
    privacyAccepted: true as const,
  }
}

describe('cadastro público', () => {
  test('cria a empresa em período de teste, com o prazo do plano', async () => {
    const plano = await planoSemeado()

    const resposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/signup',
      payload: corpoDoCadastro(plano.id, 'a'),
    })

    assert.equal(resposta.statusCode, 201)
    const criada = resposta.json()

    const [empresa] = await db
      .select({ status: companies.subscriptionStatus, trialEndsOn: companies.trialEndsOn, planId: companies.planId })
      .from(companies)
      .where(eq(companies.id, criada.company.id))

    assert.equal(empresa.status, 'teste')
    assert.equal(empresa.planId, plano.id)
    // O dia do cadastro conta como o primeiro dos quinze.
    assert.equal(empresa.trialEndsOn, addDaysToIsoDate(todayIsoDate(), plano.trialDays - 1))
  })

  test('não devolve senha nem dado de outra empresa', async () => {
    const plano = await planoSemeado()

    const resposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/signup',
      payload: corpoDoCadastro(plano.id, 'b'),
    })

    const corpo = resposta.json()
    assert.deepEqual(Object.keys(corpo).sort(), ['admin', 'company', 'trialEndsOn'])
    assert.equal(corpo.admin.password, undefined)
    assert.equal(corpo.admin.passwordHash, undefined)
  })

  test('grava quando o aviso de privacidade foi aceito', async () => {
    const plano = await planoSemeado()
    const antes = new Date()

    const resposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/signup',
      payload: corpoDoCadastro(plano.id, 'lgpd'),
    })

    const [empresa] = await db
      .select({ aceiteEm: companies.privacyAcceptedAt })
      .from(companies)
      .where(eq(companies.id, resposta.json().company.id))

    assert.ok(empresa.aceiteEm, 'o aceite precisa deixar rastro, senão não prova nada depois')
    assert.ok(empresa.aceiteEm >= new Date(antes.getTime() - 1000))
  })

  /** Sem aceite não há cadastro, e mandar `false` tem que ser recusado, não tratado como omissão. */
  test('recusa o cadastro sem o aceite do aviso de privacidade', async () => {
    const plano = await planoSemeado()

    for (const aceite of [false, undefined]) {
      const payload = { ...corpoDoCadastro(plano.id, 'sem-aceite'), privacyAccepted: aceite }
      const resposta = await ctx.app.inject({ method: 'POST', url: '/api/signup', payload })

      assert.equal(resposta.statusCode, 422, `aceite ${aceite} deveria ser recusado`)
    }
  })

  test('recusa plano inexistente', async () => {
    const resposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/signup',
      payload: corpoDoCadastro('00000000-0000-4000-8000-000000000000', 'c'),
    })

    assert.equal(resposta.statusCode, 404)
  })

  /**
   * A consulta de CEP vivia dentro das rotas de `super_admin`, e por isso digitar o CEP no cadastro
   * público devolvia 401, que o front lia como sessão encerrada e mandava para o login no meio do
   * preenchimento. O CEP inválido é de propósito: ele é recusado antes de qualquer ida à internet,
   * então o teste prova que a rota é alcançável sem sessão sem depender de provedor externo.
   */
  test('a consulta de CEP não exige sessão', async () => {
    const resposta = await ctx.app.inject({ method: 'GET', url: '/api/address/cep/123' })

    assert.equal(resposta.statusCode, 422)
    assert.notEqual(resposta.statusCode, 401)
  })

  test('a lista de planos é pública', async () => {
    const resposta = await ctx.app.inject({ method: 'GET', url: '/api/plans' })

    assert.equal(resposta.statusCode, 200)
    assert.ok(resposta.json().length >= 1)
  })
})

describe('bloqueio por teste vencido', () => {
  async function empresaComTesteVencido(sufixo: string) {
    const tenant = await createTenant(sufixo)
    await db
      .update(companies)
      .set({ subscriptionStatus: 'teste', trialEndsOn: addDaysToIsoDate(todayIsoDate(), -1) })
      .where(eq(companies.id, tenant.companyId))
    return tenant
  }

  test('rota comum responde 402 depois do último dia', async () => {
    const tenant = await empresaComTesteVencido('venc')

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })

    assert.equal(resposta.statusCode, 402)
    assert.equal(resposta.json().error.code, 'ASSINATURA_NECESSARIA')
  })

  test('no último dia ainda passa', async () => {
    const tenant = await createTenant('ultimo')
    await db
      .update(companies)
      .set({ subscriptionStatus: 'teste', trialEndsOn: todayIsoDate() })
      .where(eq(companies.id, tenant.companyId))

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })

    assert.equal(resposta.statusCode, 200)
  })

  test('a tela de assinatura continua acessível com o teste vencido', async () => {
    const tenant = await empresaComTesteVencido('assin')

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/subscription',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })

    assert.equal(resposta.statusCode, 200)
    assert.equal(resposta.json().bloqueada, true)
  })

  /** Direito de acesso do titular não depende de mensalidade paga. */
  test('a exportação de dados pessoais continua acessível com o teste vencido', async () => {
    const tenant = await empresaComTesteVencido('lgpd')

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me/personal-data',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })

    assert.equal(resposta.statusCode, 200)
  })

  test('empresa cadastrada pelo super_admin não nasce bloqueada', async () => {
    const tenant = await createTenant('manual')

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })

    assert.equal(resposta.statusCode, 200)
  })

  test('o suporte entra por impersonação mesmo com o teste vencido', async () => {
    const plataforma = await createTenant('plat')
    const suporte = await createUser(plataforma.companyId, 'super_admin', 'plat')
    const cliente = await empresaComTesteVencido('cli')

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/products',
      headers: {
        cookie: authCookie(ctx.app, suporte, {
          companyId: cliente.companyId,
          realCompanyId: plataforma.companyId,
          role: 'admin',
        }),
      },
    })

    assert.equal(resposta.statusCode, 200)
  })
})

describe('avaliarAssinatura', () => {
  test('conta dias civis e só bloqueia depois do último', () => {
    const base = { subscriptionStatus: 'teste' as const }

    assert.equal(avaliarAssinatura({ ...base, trialEndsOn: '2026-09-20' }, '2026-09-17').diasRestantes, 3)
    assert.equal(avaliarAssinatura({ ...base, trialEndsOn: '2026-09-17' }, '2026-09-17').diasRestantes, 0)
    assert.equal(avaliarAssinatura({ ...base, trialEndsOn: '2026-09-17' }, '2026-09-17').bloqueada, false)
    assert.equal(avaliarAssinatura({ ...base, trialEndsOn: '2026-09-16' }, '2026-09-17').bloqueada, true)
  })

  test('empresa em teste sem data não é bloqueada', () => {
    const situacao = avaliarAssinatura({ subscriptionStatus: 'teste', trialEndsOn: null }, '2026-09-17')

    assert.equal(situacao.bloqueada, false)
    assert.equal(situacao.diasRestantes, null)
  })

  test('fora do teste não há contador, e só cancelada bloqueia', () => {
    assert.equal(avaliarAssinatura({ subscriptionStatus: 'ativa', trialEndsOn: null }).bloqueada, false)
    assert.equal(avaliarAssinatura({ subscriptionStatus: 'atrasada', trialEndsOn: null }).bloqueada, false)
    assert.equal(avaliarAssinatura({ subscriptionStatus: 'cancelada', trialEndsOn: null }).bloqueada, true)
    assert.equal(avaliarAssinatura({ subscriptionStatus: 'ativa', trialEndsOn: null }).diasRestantes, null)
  })
})

describe('freio do cadastro público', () => {
  /**
   * O limite é por hora, e não por minuto como o do login: ninguém abre cinco lojas numa tarde, e
   * cada cadastro falso deixa empresa e usuário no banco, enquanto uma senha errada não deixa nada.
   */
  test('cadastrar muitas vezes seguidas para de ser aceito', async () => {
    const app = buildApp({ systemLogs: false })
    await app.ready()

    try {
      const codigos: number[] = []
      for (let tentativa = 0; tentativa < 8; tentativa += 1) {
        const resposta = await app.inject({
          method: 'POST',
          url: '/api/signup',
          // Plano inexistente de propósito: o freio precisa barrar antes de o corpo importar.
          payload: corpoDoCadastro('00000000-0000-4000-8000-000000000000', `rajada-${tentativa}`),
        })
        codigos.push(resposta.statusCode)
      }

      assert.ok(codigos.includes(429), `o limitador deveria ter barrado alguma tentativa: ${codigos.join(', ')}`)
    } finally {
      await app.close()
    }
  })
})
