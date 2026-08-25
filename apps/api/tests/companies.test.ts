import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { companies, users } from '../src/db/schema/index.js'
import { authCookie, createTenant, createUser, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

describe('impersonação', () => {
  test('super_admin acessa empresa ativa e perde a sessão quando ela é suspensa', async () => {
    const target = await createTenant('impersonated')
    const [platform] = await db.insert(companies).values({ name: 'Plataforma' }).returning({ id: companies.id })
    const superAdmin = await createUser(platform.id, 'super_admin', 'platform')

    const impersonateResponse = await ctx.app.inject({
      method: 'POST',
      url: `/api/companies/${target.companyId}/impersonate`,
      headers: { cookie: authCookie(ctx.app, superAdmin) },
    })
    assert.equal(impersonateResponse.statusCode, 200)
    const impersonationCookie = impersonateResponse.cookies.find(({ name }) => name === 'token')
    assert.ok(impersonationCookie)

    const activeResponse = await ctx.app.inject({
      method: 'GET',
      url: '/api/categories?page=1&pageSize=30',
      headers: { cookie: `token=${impersonationCookie.value}` },
    })
    assert.equal(activeResponse.statusCode, 200)

    await db.update(companies).set({ active: false }).where(eq(companies.id, target.companyId))

    const suspendedResponse = await ctx.app.inject({
      method: 'GET',
      url: '/api/categories?page=1&pageSize=30',
      headers: { cookie: `token=${impersonationCookie.value}` },
    })
    assert.equal(suspendedResponse.statusCode, 401)
  })

  test('a volta ao super admin funciona, e as telas da própria conta também durante o acesso', async () => {
    // Regressão do RLS: durante a impersonação a conexão está estreitada para a empresa visitada, mas
    // estas quatro leituras são da conta de quem está logado, que mora na Plataforma. Sem a travessia
    // declarada, sair do modo suporte derrubava a sessão — e um F5 na tela derrubava também.
    const target = await createTenant('volta-do-suporte')
    const [platform] = await db.insert(companies).values({ name: 'Plataforma' }).returning({ id: companies.id })
    const superAdmin = await createUser(platform.id, 'super_admin', 'volta')

    const entrada = await ctx.app.inject({
      method: 'POST',
      url: `/api/companies/${target.companyId}/impersonate`,
      headers: { cookie: authCookie(ctx.app, superAdmin) },
    })
    assert.equal(entrada.statusCode, 200)
    const cookieDeSuporte = entrada.cookies.find(({ name }) => name === 'token')
    assert.ok(cookieDeSuporte)
    const cookie = `token=${cookieDeSuporte.value}`

    const perfil = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    assert.equal(perfil.statusCode, 200, 'recarregar a tela durante o acesso não pode derrubar a sessão')
    assert.equal(perfil.json().impersonating, true)
    assert.equal(perfil.json().user.id, superAdmin.id, 'o perfil deve ser o do super admin, não o da empresa visitada')

    const dados = await ctx.app.inject({ method: 'GET', url: '/api/auth/me/personal-data', headers: { cookie } })
    assert.equal(dados.statusCode, 200)

    const saida = await ctx.app.inject({ method: 'POST', url: '/api/auth/exit-impersonation', headers: { cookie } })
    assert.equal(saida.statusCode, 200, 'sair do modo suporte não pode derrubar a sessão')
    assert.equal(saida.json().impersonating, false)
    assert.equal(saida.json().user.companyId, platform.id)

    // E o cookie devolvido tem que voltar a valer nas telas da plataforma.
    const voltou = saida.cookies.find(({ name }) => name === 'token')
    assert.ok(voltou)
    const empresas = await ctx.app.inject({
      method: 'GET',
      url: '/api/companies?page=1&pageSize=30',
      headers: { cookie: `token=${voltou.value}` },
    })
    assert.equal(empresas.statusCode, 200)
    assert.ok(empresas.json().data.length >= 1)
  })
})

describe('cadastro de empresas', () => {
  async function superAdminFixture(suffix: string) {
    const [platform] = await db.insert(companies).values({ name: 'Plataforma' }).returning({ id: companies.id })
    return createUser(platform.id, 'super_admin', suffix)
  }

  const companyPayload = {
    name: 'Mercado da Praça',
    legalName: 'Mercado da Praça Ltda',
    document: '11.222.333/0001-81',
    stateRegistration: '123456789',
    contactName: 'Maria Silva',
    contactEmail: 'contato@mercadodapraca.test',
    phone: '(11) 99999-8888',
    postalCode: '01001-000',
    street: 'Praça da Sé',
    addressNumber: '100',
    complement: 'Loja 2',
    district: 'Sé',
    city: 'São Paulo',
    state: 'sp',
    adminName: 'Administradora',
    adminEmail: 'admin@mercadodapraca.test',
    adminPassword: 'senha-forte-123',
  }

  test('cria empresa com identificação, contato e endereço normalizados', async () => {
    const superAdmin = await superAdminFixture('company-create')
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/companies',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: companyPayload,
    })

    assert.equal(response.statusCode, 201)
    const result = response.json<{ company: { document: string; phone: string; postalCode: string; state: string } }>()
    assert.equal(result.company.document, '11222333000181')
    assert.equal(result.company.phone, '11999998888')
    assert.equal(result.company.postalCode, '01001000')
    assert.equal(result.company.state, 'SP')
  })

  /**
   * CNPJ alfanumérico da IN RFB 2.229/2024. O exemplo oficial da Receita é 12.ABC.345/01DE-35,
   * e os dígitos verificadores só fecham com o valor ASCII menos 48 de cada posição.
   */
  test('aceita CNPJ alfanumérico, em minúsculas e com pontuação', async () => {
    const superAdmin = await superAdminFixture('company-cnpj-alfa')
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/companies',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: { ...companyPayload, document: '12.abc.345/01de-35', contactEmail: 'alfa@mercado.test', adminEmail: 'admin-alfa@mercado.test' },
    })

    assert.equal(response.statusCode, 201, response.body)
    assert.equal(response.json<{ company: { document: string } }>().company.document, '12ABC34501DE35')
  })

  test('recusa dígito verificador errado no CNPJ alfanumérico e letra no verificador', async () => {
    const superAdmin = await superAdminFixture('company-cnpj-alfa-invalido')
    for (const document of ['12.ABC.345/01DE-34', '12.ABC.345/01DE-3A']) {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: { cookie: authCookie(ctx.app, superAdmin) },
        payload: { ...companyPayload, document },
      })
      assert.equal(response.statusCode, 422, `${document} deveria ser recusado`)
      assert.match(response.body, /CNPJ inválido/)
    }
  })

  test('rejeita CNPJ inválido e impede CNPJ duplicado', async () => {
    const superAdmin = await superAdminFixture('company-validation')
    const invalid = await ctx.app.inject({
      method: 'POST',
      url: '/api/companies',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: { ...companyPayload, document: '11.111.111/1111-11' },
    })
    assert.equal(invalid.statusCode, 422)

    const first = await ctx.app.inject({
      method: 'POST',
      url: '/api/companies',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: companyPayload,
    })
    assert.equal(first.statusCode, 201)

    const duplicate = await ctx.app.inject({
      method: 'POST',
      url: '/api/companies',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: { ...companyPayload, adminEmail: 'outro-admin@test.local' },
    })
    assert.equal(duplicate.statusCode, 409)
    assert.match(duplicate.body, /CNPJ/)
  })

  test('recusa UF que não existe', async () => {
    const superAdmin = await superAdminFixture('company-uf')
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/companies',
      headers: { cookie: authCookie(ctx.app, superAdmin) },
      payload: { ...companyPayload, state: 'XX' },
    })

    assert.equal(response.statusCode, 422)
    assert.match(response.body, /UF/)
  })
})

describe('proteção da empresa Plataforma', () => {
  async function plataforma(suffix: string) {
    const [platform] = await db.insert(companies).values({ name: 'Plataforma' }).returning({ id: companies.id })
    const dono = await createUser(platform.id, 'super_admin', `dono-${suffix}`)
    const socio = await createUser(platform.id, 'super_admin', `socio-${suffix}`)
    return { platformId: platform.id, dono, socio }
  }

  test('não pode ser acessada como suporte', async () => {
    const { platformId, dono } = await plataforma('bloqueio')

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/companies/${platformId}/impersonate`,
      headers: { cookie: authCookie(ctx.app, dono) },
    })

    assert.equal(response.statusCode, 403)
    assert.match(response.body, /plataforma/i)
  })

  test('nenhum super_admin fica exposto na tela de usuários por essa via', async () => {
    const { platformId, dono, socio } = await plataforma('sem-rebaixar')

    const cookieForjado = authCookie(ctx.app, dono, {
      companyId: platformId,
      realCompanyId: platformId,
      role: 'admin',
    })

    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${socio.id}`,
      headers: { cookie: cookieForjado },
      payload: { role: 'operador' },
    })

    assert.equal(response.statusCode, 401, 'a sessão forjada não deve ser aceita')

    const [depois] = await db.select({ role: users.role }).from(users).where(eq(users.id, socio.id))
    assert.equal(depois.role, 'super_admin')
  })

  test('empresa-cliente comum continua acessível como suporte', async () => {
    const { dono } = await plataforma('cliente-ok')
    const cliente = await createTenant('suporte-ok')

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/companies/${cliente.companyId}/impersonate`,
      headers: { cookie: authCookie(ctx.app, dono) },
    })

    assert.equal(response.statusCode, 200)
  })
})
