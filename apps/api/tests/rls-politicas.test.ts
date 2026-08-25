import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { eq } from 'drizzle-orm'
import { db as dbDaAplicacao } from '../src/db/client.js'
import { comEscopoDaEmpresa } from '../src/db/scope.js'
import { products, stockEntries, stockEntryItems } from '../src/db/schema/index.js'
import { db } from './db.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'
import { createStockEntry } from './servicos.js'

const ctx = setupTestApp()

// O Drizzle embrulha o erro: a mensagem de fora é "Failed query: …" e o texto do RLS fica em `cause`.
// Comparar só a de fora daria teste que passa sem provar nada.
function recusadoPeloRls(erro: unknown) {
  const externa = erro instanceof Error ? erro.message : String(erro)
  const interna = erro instanceof Error && erro.cause instanceof Error ? erro.cause.message : ''
  assert.match(`${externa} ${interna}`, /row-level security/)
  return true
}

describe('políticas de RLS por empresa', () => {
  it('consulta sem filtro de empresa devolve só a própria empresa', async () => {
    const minha = await createTenant('rls-sem-filtro-a')
    const vizinha = await createTenant('rls-sem-filtro-b')

    const semFiltro = await comEscopoDaEmpresa(minha.companyId, () =>
      dbDaAplicacao.select({ id: products.id, companyId: products.companyId }).from(products),
    )

    assert.equal(semFiltro.length, 1, 'a consulta sem filtro deveria alcançar apenas uma empresa')
    assert.equal(semFiltro[0].id, minha.productId)
    assert.ok(
      !semFiltro.some((linha) => linha.companyId === vizinha.companyId),
      'produto de outra empresa apareceu numa consulta sem filtro',
    )

    const semEscopo = await dbDaAplicacao.select({ id: products.id }).from(products)
    assert.equal(semEscopo.length, 0, 'sem escopo definido a consulta deveria voltar vazia')
  })

  it('recusa gravar registro de outra empresa', async () => {
    const minha = await createTenant('rls-grava-a')
    const vizinha = await createTenant('rls-grava-b')

    await assert.rejects(
      () =>
        comEscopoDaEmpresa(minha.companyId, () =>
          dbDaAplicacao.insert(products).values({
            companyId: vizinha.companyId,
            categoryId: vizinha.categoryId,
            unitId: vizinha.unitId,
            name: 'Produto plantado na empresa errada',
            createdBy: vizinha.admin.id,
          }),
        ),
      recusadoPeloRls,
      'a gravação em outra empresa deveria ser recusada pelo banco',
    )
  })

  it('atualização sem filtro não alcança linha de outra empresa', async () => {
    const minha = await createTenant('rls-update-a')
    const vizinha = await createTenant('rls-update-b')

    const resultado = await comEscopoDaEmpresa(minha.companyId, () =>
      dbDaAplicacao.update(products).set({ name: 'Renomeado por engano' }).where(eq(products.id, vizinha.productId)),
    )

    assert.equal(resultado.rowCount, 0, 'o UPDATE alcançou linha de outra empresa')

    const [intacto] = await db.select({ name: products.name }).from(products).where(eq(products.id, vizinha.productId))
    assert.equal(intacto.name, 'Produto rls-update-b')
  })

  it('itens da entrada ficam protegidos pela entrada, sem coluna de empresa própria', async () => {
    const minha = await createTenant('rls-itens-a')
    const vizinha = await createTenant('rls-itens-b')

    await createStockEntry(vizinha.companyId, vizinha.admin.id, {
      supplierName: 'Fornecedor do vizinho',
      items: [{ productId: vizinha.productId, quantity: '5', unitCost: '2.50' }],
    })

    const itens = await comEscopoDaEmpresa(minha.companyId, () =>
      dbDaAplicacao.select({ id: stockEntryItems.id }).from(stockEntryItems),
    )

    assert.equal(itens.length, 0, 'item de entrada de outra empresa apareceu')

    const entradas = await comEscopoDaEmpresa(minha.companyId, () =>
      dbDaAplicacao.select({ id: stockEntries.id }).from(stockEntries),
    )
    assert.equal(entradas.length, 0)
  })

  it('duas requisições simultâneas de empresas diferentes não trocam de escopo', async () => {
    // Se a devolução ao pool deixasse a empresa marcada, ou se duas requisições dividissem conexão,
    // este teste pegaria.
    const primeira = await createTenant('rls-simultaneo-a')
    const segunda = await createTenant('rls-simultaneo-b')

    const pedir = (tenant: Awaited<ReturnType<typeof createTenant>>) =>
      ctx.app.inject({
        method: 'GET',
        url: '/api/products?page=1&pageSize=50',
        headers: { cookie: authCookie(ctx.app, tenant.admin) },
      })

    const rodadas = await Promise.all([
      pedir(primeira),
      pedir(segunda),
      pedir(primeira),
      pedir(segunda),
      pedir(primeira),
      pedir(segunda),
    ])

    const esperado = [primeira, segunda, primeira, segunda, primeira, segunda]

    rodadas.forEach((resposta, indice) => {
      assert.equal(resposta.statusCode, 200)
      const itens = resposta.json().data as Array<{ id: string }>
      assert.equal(itens.length, 1, `requisição ${indice} trouxe ${itens.length} produtos`)
      assert.equal(itens[0].id, esperado[indice].productId, `requisição ${indice} viu produto de outra empresa`)
    })
  })
})
