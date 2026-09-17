import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { companies, plans } from '../src/db/schema/index.js'
import { db } from './db.js'
import { authCookie, createTenant, createUser, setupTestApp } from './helpers.js'

const ctx = setupTestApp({ rateLimit: false })

async function superAdminCookie(sufixo: string) {
  const [plataforma] = await db.insert(companies).values({ name: `Plataforma ${sufixo}` }).returning({ id: companies.id })
  const conta = await createUser(plataforma.id, 'super_admin', `plat-${sufixo}`)
  return authCookie(ctx.app, conta)
}

function empresa(nome: string, sufixo: string) {
  return {
    name: nome,
    legalName: `Razão ${sufixo} LTDA`,
    document: sufixo === 'a' ? '11222333000181' : '11444777000161',
    stateRegistration: sufixo === 'a' ? '111222333' : '444555666',
    contactName: 'Responsável',
    contactEmail: `contato-${sufixo}@teste.local`,
    phone: '11999998888',
    postalCode: '01001000',
    street: 'Praça da Sé',
    addressNumber: '1',
    district: 'Sé',
    city: 'São Paulo',
    state: 'SP',
    adminName: 'Administrador',
    adminEmail: `admin-${sufixo}@teste.local`,
    adminPassword: 'senha-bem-forte-123',
  }
}

function cadastrar(cookie: string, payload: Record<string, unknown>) {
  return ctx.app.inject({ method: 'POST', url: '/api/companies', headers: { cookie }, payload })
}

describe('nome fantasia único entre empresas ativas', () => {
  test('o segundo cadastro com o mesmo nome é recusado, apontando o campo', async () => {
    const cookie = await superAdminCookie('dup')

    assert.equal((await cadastrar(cookie, empresa('Frutaria Rincão', 'a'))).statusCode, 201)

    const segunda = await cadastrar(cookie, empresa('Frutaria Rincão', 'b'))

    assert.equal(segunda.statusCode, 409)
    assert.deepEqual(segunda.json().error.issues.name, ['Já existe uma empresa com esse nome fantasia'])
  })

  /**
   * Quem administra lê a lista, e para quem lê "FRUTARIA RINCÃO  " e "Frutaria Rincão" são a mesma
   * coisa. Deixar passar por diferença de caixa ou de espaço seria não resolver o problema.
   */
  test('caixa diferente e espaço sobrando não driblam a regra', async () => {
    const cookie = await superAdminCookie('caixa')

    assert.equal((await cadastrar(cookie, empresa('Frutaria Rincão', 'a'))).statusCode, 201)

    for (const variacao of ['FRUTARIA RINCÃO', '  frutaria rincão  ']) {
      const resposta = await cadastrar(cookie, { ...empresa(variacao, 'b'), name: variacao })
      assert.equal(resposta.statusCode, 409, `"${variacao}" deveria ser recusado`)
    }
  })

  test('nomes diferentes continuam passando', async () => {
    const cookie = await superAdminCookie('ok')

    assert.equal((await cadastrar(cookie, empresa('Frutaria Rincão', 'a'))).statusCode, 201)
    assert.equal((await cadastrar(cookie, empresa('Frutaria do Zé', 'b'))).statusCode, 201)
  })

  test('renomear uma empresa para o nome de outra é recusado', async () => {
    const cookie = await superAdminCookie('ren')
    const primeira = await cadastrar(cookie, empresa('Frutaria Rincão', 'a'))
    const segunda = await cadastrar(cookie, empresa('Frutaria do Zé', 'b'))

    const conflito = await ctx.app.inject({
      method: 'PUT',
      url: `/api/companies/${segunda.json().company.id}`,
      headers: { cookie },
      payload: { name: 'Frutaria Rincão' },
    })

    assert.equal(conflito.statusCode, 409)
    assert.ok(primeira.json().company.id)
  })

  /** Salvar a edição sem mexer no nome não pode esbarrar na própria linha. */
  test('salvar a empresa mantendo o próprio nome continua funcionando', async () => {
    const cookie = await superAdminCookie('mesmo')
    const criada = await cadastrar(cookie, empresa('Frutaria Rincão', 'a'))

    const resposta = await ctx.app.inject({
      method: 'PUT',
      url: `/api/companies/${criada.json().company.id}`,
      headers: { cookie },
      payload: { name: 'Frutaria Rincão', city: 'Joinville' },
    })

    assert.equal(resposta.statusCode, 200)
  })

  test('empresa excluída libera o nome de volta', async () => {
    const cookie = await superAdminCookie('excl')
    const criada = await cadastrar(cookie, empresa('Frutaria Rincão', 'a'))

    await db
      .update(companies)
      .set({ deletedAt: new Date() })
      .where(eq(companies.id, criada.json().company.id))

    assert.equal((await cadastrar(cookie, empresa('Frutaria Rincão', 'b'))).statusCode, 201)
  })

  test('o cadastro público obedece à mesma regra', async () => {
    const tenant = await createTenant('publico')
    await db.update(companies).set({ name: 'Frutaria Rincão' }).where(eq(companies.id, tenant.companyId))

    const [plano] = await db.select({ id: plans.id }).from(plans).limit(1)

    const resposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/signup',
      payload: { ...empresa('Frutaria Rincão', 'b'), planId: plano.id, privacyAccepted: true },
    })

    assert.equal(resposta.statusCode, 409)
    assert.deepEqual(resposta.json().error.issues.name, ['Já existe uma empresa com esse nome fantasia'])
  })
})

describe('os outros campos que não podem se repetir', () => {
  const CASOS = [
    { campo: 'legalName', valor: 'Mesma Razão Social LTDA', mensagem: 'Já existe uma empresa com essa razão social' },
    { campo: 'stateRegistration', valor: '987654321', mensagem: 'Já existe uma empresa com essa inscrição estadual' },
    { campo: 'contactEmail', valor: 'mesmo@contato.local', mensagem: 'Já existe uma empresa com esse e-mail de contato' },
  ] as const

  for (const caso of CASOS) {
    test(`${caso.campo} repetido é recusado apontando o campo`, async () => {
      const cookie = await superAdminCookie(`dup-${caso.campo}`)

      const primeira = { ...empresa('Frutaria Uma', 'a'), [caso.campo]: caso.valor }
      assert.equal((await cadastrar(cookie, primeira)).statusCode, 201)

      const segunda = { ...empresa('Frutaria Outra', 'b'), [caso.campo]: caso.valor }
      const resposta = await cadastrar(cookie, segunda)

      assert.equal(resposta.statusCode, 409)
      assert.deepEqual(resposta.json().error.issues[caso.campo], [caso.mensagem])
    })
  }

  /**
   * Isento não é um número de inscrição, é a ausência de um escrito por extenso, e é comum. Tratá-lo
   * como registro recusaria a segunda empresa isenta que aparecesse.
   */
  test('inscrição estadual "Isento" pode se repetir', async () => {
    const cookie = await superAdminCookie('isento')

    assert.equal(
      (await cadastrar(cookie, { ...empresa('Frutaria Uma', 'a'), stateRegistration: 'Isento' })).statusCode,
      201,
    )
    assert.equal(
      (await cadastrar(cookie, { ...empresa('Frutaria Outra', 'b'), stateRegistration: 'ISENTO' })).statusCode,
      201,
    )
  })

  /** Estes três repetem de propósito: mesmo dono com duas lojas, xará, e galeria com dois boxes. */
  test('telefone, nome do contato e endereço continuam podendo se repetir', async () => {
    const cookie = await superAdminCookie('repetiveis')

    const primeira = empresa('Frutaria Uma', 'a')
    assert.equal((await cadastrar(cookie, primeira)).statusCode, 201)

    const segunda = {
      ...empresa('Frutaria Outra', 'b'),
      phone: primeira.phone,
      contactName: primeira.contactName,
      postalCode: primeira.postalCode,
      street: primeira.street,
      addressNumber: primeira.addressNumber,
      district: primeira.district,
      city: primeira.city,
      state: primeira.state,
    }

    assert.equal((await cadastrar(cookie, segunda)).statusCode, 201)
  })

  /**
   * Quem cola o cadastro inteiro de outra empresa precisa ver os quatro problemas de uma vez. Um por
   * resposta obrigaria a enviar quatro vezes para descobrir o que está errado.
   */
  test('vários campos repetidos são reclamados na mesma resposta', async () => {
    const cookie = await superAdminCookie('varios')
    const primeira = empresa('Frutaria Uma', 'a')
    assert.equal((await cadastrar(cookie, primeira)).statusCode, 201)

    const copiada = { ...primeira, adminEmail: 'outro-admin@teste.local' }
    const resposta = await cadastrar(cookie, copiada)

    assert.equal(resposta.statusCode, 409)
    assert.deepEqual(Object.keys(resposta.json().error.issues).sort(), [
      'contactEmail',
      'document',
      'legalName',
      'name',
      'stateRegistration',
    ])
  })

  test('o administrador de outra empresa pode ter o mesmo nome, mas não o mesmo e-mail', async () => {
    const cookie = await superAdminCookie('admin')

    const primeira = empresa('Frutaria Uma', 'a')
    assert.equal((await cadastrar(cookie, primeira)).statusCode, 201)

    const mesmoNome = { ...empresa('Frutaria Outra', 'b'), adminName: primeira.adminName }
    assert.equal((await cadastrar(cookie, mesmoNome)).statusCode, 201, 'xará é caso real')

    const mesmoEmail = { ...empresa('Frutaria Terceira', 'c'), adminEmail: primeira.adminEmail }
    const conflito = await cadastrar(cookie, { ...mesmoEmail, document: '11444777000161' })
    assert.equal(conflito.statusCode, 409)
    assert.ok(conflito.json().error.issues.adminEmail)
  })
})
