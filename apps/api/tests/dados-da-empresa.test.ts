import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { companies } from '../src/db/schema/index.js'
import { db } from './db.js'
import { authCookie, createTenant, createUser, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

describe('dados da própria empresa no perfil', () => {
  test('o administrador vê os dados cadastrais da empresa dele', async () => {
    const tenant = await createTenant('propria')
    await db
      .update(companies)
      .set({ legalName: 'Hortifruti Teste LTDA', document: '11222333000181', city: 'Joinville' })
      .where(eq(companies.id, tenant.companyId))

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/company',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })

    assert.equal(resposta.statusCode, 200)
    assert.equal(resposta.json().legalName, 'Hortifruti Teste LTDA')
    assert.equal(resposta.json().city, 'Joinville')
  })

  test('gerente e operador não alcançam a rota', async () => {
    const tenant = await createTenant('sem-acesso')

    for (const usuario of [tenant.manager, tenant.operator]) {
      const resposta = await ctx.app.inject({
        method: 'GET',
        url: '/api/company',
        headers: { cookie: authCookie(ctx.app, usuario) },
      })

      assert.equal(resposta.statusCode, 403, `${usuario.role} não deveria ver os dados da empresa`)
    }
  })

  test('sem sessão não devolve nada', async () => {
    const resposta = await ctx.app.inject({ method: 'GET', url: '/api/company' })

    assert.equal(resposta.statusCode, 401)
  })

  /** A rota não recebe identificador: ela lê a empresa da sessão, e é isso que a torna inofensiva. */
  test('o administrador de uma empresa não vê a empresa da outra', async () => {
    const umaEmpresa = await createTenant('uma')
    const outraEmpresa = await createTenant('outra')
    await db
      .update(companies)
      .set({ legalName: 'Empresa Da Outra LTDA' })
      .where(eq(companies.id, outraEmpresa.companyId))

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/company',
      headers: { cookie: authCookie(ctx.app, umaEmpresa.admin) },
    })

    assert.notEqual(resposta.json().legalName, 'Empresa Da Outra LTDA')
  })

  test('o suporte em impersonação vê os dados da empresa visitada', async () => {
    const plataforma = await createTenant('plat')
    const suporte = await createUser(plataforma.companyId, 'super_admin', 'plat')
    const cliente = await createTenant('cliente')
    await db
      .update(companies)
      .set({ legalName: 'Cliente Visitado LTDA' })
      .where(eq(companies.id, cliente.companyId))

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/company',
      headers: {
        cookie: authCookie(ctx.app, suporte, {
          companyId: cliente.companyId,
          realCompanyId: plataforma.companyId,
          role: 'admin',
        }),
      },
    })

    assert.equal(resposta.statusCode, 200)
    assert.equal(resposta.json().legalName, 'Cliente Visitado LTDA')
  })
})
