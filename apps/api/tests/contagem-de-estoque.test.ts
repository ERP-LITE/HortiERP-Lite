import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq, sql } from 'drizzle-orm'
import { setTimeout as esperar } from 'node:timers/promises'
import { db } from './db.js'
import { products, stockCountItems, stockCounts, stockMovements } from '../src/db/schema/index.js'
import { db as dbDaAplicacao } from '../src/db/client.js'
import { comEscopoDaEmpresa } from '../src/db/scope.js'
import { authCookie, createTenant, setupTestApp, type FixtureUser } from './helpers.js'
import { divergenciaDaLinha, resumoDaContagem } from '../src/modules/stock-counts/divergencia.js'

const ctx = setupTestApp()

describe('lançamento concorrente com mudança de etapa', () => {
  for (const status of ['em_conferencia', 'cancelada'] as const) {
    test(`lançamento aguarda a transição para ${status} e não altera a contagem`, async () => {
      const tenant = await createTenant(`corrida-${status}`, '18')
      const contagem = await abrirContagem(tenant.admin)
      let terminou = false
      let resposta: ReturnType<typeof lancar> | undefined

      await db.transaction(async (tx) => {
        await tx.select().from(stockCounts).where(eq(stockCounts.id, contagem.id)).for('update')
        resposta = lancar(tenant.operator, contagem.id, tenant.productId, 7)
        void resposta.then(() => { terminou = true })

        // Espera o lançamento chegar à trava (ou terminar indevidamente), sem depender da velocidade da máquina.
        let bloqueado = false
        for (let tentativa = 0; tentativa < 200 && !terminou; tentativa += 1) {
          const resultado = await tx.execute<{ bloqueado: boolean }>(sql`
            select exists (
              select 1 from pg_stat_activity
              where pg_backend_pid() = any(pg_blocking_pids(pid))
            ) as bloqueado
          `)
          bloqueado = resultado.rows[0].bloqueado
          if (bloqueado) break
          await esperar(10)
        }
        assert.ok(terminou || bloqueado, 'o lançamento não chegou ao banco dentro do prazo')
        await tx.update(stockCounts).set({ status }).where(eq(stockCounts.id, contagem.id))
      })

      const resultado = await resposta!
      assert.equal(resultado.statusCode, 422, resultado.body)
      const [item] = await db.select().from(stockCountItems).where(eq(stockCountItems.stockCountId, contagem.id))
      assert.equal(item.countedQuantity, null)
    })
  }
})

function comoUsuario(user: FixtureUser) {
  return { cookie: authCookie(ctx.app, user) }
}

async function abrirContagem(admin: FixtureUser, body: Record<string, unknown> = {}) {
  const resposta = await ctx.app.inject({
    method: 'POST',
    url: '/api/stock-counts',
    headers: comoUsuario(admin),
    payload: body,
  })
  assert.equal(resposta.statusCode, 201, resposta.body)
  return resposta.json() as { id: string; status: string }
}

function lancar(user: FixtureUser, countId: string, productId: string, countedQuantity: number | null) {
  return ctx.app.inject({
    method: 'PATCH',
    url: `/api/stock-counts/${countId}/items/${productId}`,
    headers: comoUsuario(user),
    payload: { countedQuantity },
  })
}

function acao(user: FixtureUser, countId: string, nome: string, payload?: Record<string, unknown>) {
  return ctx.app.inject({
    method: 'POST',
    url: `/api/stock-counts/${countId}/${nome}`,
    headers: comoUsuario(user),
    payload: payload ?? {},
  })
}

interface ItemDaContagem {
  productId: string
  productName: string
  countedQuantity: string | null
  previousQuantity: string | null
  unitCost: string | null
  difference: number | null
  differenceValue: number | null
}

async function listarItens(user: FixtureUser, countId: string, query = '') {
  const resposta = await ctx.app.inject({
    method: 'GET',
    url: `/api/stock-counts/${countId}/items?page=1&pageSize=50${query}`,
    headers: comoUsuario(user),
  })
  return resposta
}

async function criarProduto(tenant: Awaited<ReturnType<typeof createTenant>>, nome: string, estoque: string, custo: string) {
  const [produto] = await db
    .insert(products)
    .values({
      companyId: tenant.companyId,
      categoryId: tenant.categoryId,
      unitId: tenant.unitId,
      name: nome,
      currentStock: estoque,
      costPrice: custo,
      createdBy: tenant.admin.id,
    })
    .returning({ id: products.id })
  return produto.id
}

describe('cálculo de divergência da contagem', () => {
  test('produto não contado não vira divergência', () => {
    assert.deepEqual(divergenciaDaLinha({ countedQuantity: null, previousQuantity: '10', unitCost: '2' }), {
      difference: null,
      differenceValue: null,
    })
  })

  test('sem custo cadastrado a diferença existe mas não tem valor', () => {
    assert.deepEqual(divergenciaDaLinha({ countedQuantity: '8', previousQuantity: '10', unitCost: null }), {
      difference: -2,
      differenceValue: null,
    })
  })

  test('diferença fracionada não escorrega no arredondamento', () => {
    const { difference, differenceValue } = divergenciaDaLinha({
      countedQuantity: '0.3',
      previousQuantity: '0.1',
      unitCost: '3.33',
    })
    assert.equal(difference, 0.2)
    assert.equal(differenceValue, 0.67)
  })

  test('resumo separa sobra de falta e devolve o saldo', () => {
    const resumo = resumoDaContagem([
      { countedQuantity: '12', previousQuantity: '10', unitCost: '5' },
      { countedQuantity: '4', previousQuantity: '10', unitCost: '2.50' },
      { countedQuantity: '7', previousQuantity: '7', unitCost: '1' },
      { countedQuantity: null, previousQuantity: '9', unitCost: '1' },
    ])

    assert.equal(resumo.itemsCount, 4)
    assert.equal(resumo.countedCount, 3)
    assert.equal(resumo.pendingCount, 1)
    assert.equal(resumo.divergentCount, 2)
    assert.equal(resumo.positiveValue, 10)
    assert.equal(resumo.negativeValue, 15)
    assert.equal(resumo.netValue, -5)
  })
})

describe('contagem cega', () => {
  test('o histórico aceita o filtro de contagem oferecido pela tela', async () => {
    const tenant = await createTenant('contagem-filtro-atividade', '18')
    const contagem = await abrirContagem(tenant.admin)
    const resposta = await ctx.app.inject({
      url: '/api/logs/activity?entity=contagem',
      headers: comoUsuario(tenant.admin),
    })
    assert.equal(resposta.statusCode, 200, resposta.body)
    assert.equal(resposta.json().total, 1)
    assert.equal(resposta.json().data[0].entityId, contagem.id)
    assert.equal(resposta.json().data[0].entity, 'contagem')
  })

  test('em andamento a API não devolve saldo, custo nem divergência', async () => {
    const tenant = await createTenant('contagem-cega', '18')
    const contagem = await abrirContagem(tenant.admin)

    const resposta = await listarItens(tenant.admin, contagem.id)
    assert.equal(resposta.statusCode, 200)
    const [item] = resposta.json().data as ItemDaContagem[]

    assert.equal(item.productId, tenant.productId)
    assert.equal(item.previousQuantity, null)
    assert.equal(item.unitCost, null)
    assert.equal(item.difference, null)
    assert.equal(item.differenceValue, null)
    // Confere os valores, não o texto cru: um uuid sorteado começando com "18" tornava o teste
    // instável sem nada ter vazado.
    assert.ok(
      !Object.values(item).includes('18.000'),
      `o saldo do sistema vazou na resposta: ${JSON.stringify(item)}`,
    )
  })

  test('filtrar por divergentes é recusado enquanto a contagem está cega', async () => {
    const tenant = await createTenant('contagem-filtro-cego', '18')
    const contagem = await abrirContagem(tenant.admin)

    const resposta = await listarItens(tenant.admin, contagem.id, '&situacao=divergentes')
    assert.equal(resposta.statusCode, 422)
    assert.equal(resposta.json().error.code, 'COUNT_STILL_BLIND')
  })

  test('o resumo em andamento mostra o que falta contar e nada de valor', async () => {
    const tenant = await createTenant('contagem-resumo-cego', '18')
    await criarProduto(tenant, 'Segundo produto', '5', '2.00')
    const contagem = await abrirContagem(tenant.admin)

    await lancar(tenant.operator, contagem.id, tenant.productId, 10)

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-counts/${contagem.id}`,
      headers: comoUsuario(tenant.admin),
    })

    const corpo = resposta.json() as { revelada: boolean; resumo: Record<string, number> }
    assert.equal(corpo.revelada, false)
    assert.equal(corpo.resumo.itemsCount, 2)
    assert.equal(corpo.resumo.countedCount, 1)
    assert.equal(corpo.resumo.pendingCount, 1)
    assert.equal(corpo.resumo.divergentCount, 0)
    assert.equal(corpo.resumo.netValue, 0)
  })

  test('conferência revela o saldo e reabrir esconde de novo', async () => {
    const tenant = await createTenant('contagem-revela', '18')
    await db.update(products).set({ costPrice: '7.00' }).where(eq(products.id, tenant.productId))
    const contagem = await abrirContagem(tenant.admin)
    await lancar(tenant.operator, contagem.id, tenant.productId, 14)

    assert.equal((await acao(tenant.admin, contagem.id, 'review')).statusCode, 200)

    const revelada = await listarItens(tenant.admin, contagem.id)
    const [item] = revelada.json().data as ItemDaContagem[]
    assert.equal(item.previousQuantity, '18.000')
    assert.equal(item.difference, -4)
    assert.equal(item.differenceValue, -28)

    assert.equal((await acao(tenant.admin, contagem.id, 'reopen')).statusCode, 200)

    const escondida = await listarItens(tenant.admin, contagem.id)
    const [depois] = escondida.json().data as ItemDaContagem[]
    assert.equal(depois.previousQuantity, null)
    assert.equal(depois.countedQuantity, '14.000', 'reabrir não pode apagar o que já foi contado')
  })
})

describe('lançamento do que foi contado', () => {
  test('operador lança e o valor sobrevive a uma nova consulta', async () => {
    const tenant = await createTenant('contagem-lancamento', '18')
    const contagem = await abrirContagem(tenant.admin)

    const resposta = await lancar(tenant.operator, contagem.id, tenant.productId, 22.5)
    assert.equal(resposta.statusCode, 200)
    assert.equal(resposta.json().countedQuantity, '22.500')

    const [item] = (await listarItens(tenant.operator, contagem.id)).json().data as ItemDaContagem[]
    assert.equal(item.countedQuantity, '22.500')
  })

  test('lançar nulo devolve o produto para a fila de pendentes', async () => {
    const tenant = await createTenant('contagem-desfaz', '18')
    const contagem = await abrirContagem(tenant.admin)

    await lancar(tenant.operator, contagem.id, tenant.productId, 22)
    const resposta = await lancar(tenant.operator, contagem.id, tenant.productId, null)
    assert.equal(resposta.statusCode, 200)
    assert.equal(resposta.json().countedQuantity, null)

    const pendentes = await listarItens(tenant.admin, contagem.id, '&situacao=pendentes')
    assert.equal((pendentes.json().data as ItemDaContagem[]).length, 1)
  })

  test('produto de fora da contagem não é aceito', async () => {
    const tenant = await createTenant('contagem-fora', '18')
    const outraCategoria = await criarProduto(tenant, 'Produto de fora', '5', '1.00')
    const contagem = await abrirContagem(tenant.admin)

    await db.delete(stockCountItems).where(eq(stockCountItems.productId, outraCategoria))

    const resposta = await lancar(tenant.operator, contagem.id, outraCategoria, 3)
    assert.equal(resposta.statusCode, 404)
  })

  test('contagem em conferência não aceita mais lançamento', async () => {
    const tenant = await createTenant('contagem-fechada', '18')
    const contagem = await abrirContagem(tenant.admin)
    await lancar(tenant.operator, contagem.id, tenant.productId, 10)
    await acao(tenant.admin, contagem.id, 'review')

    const resposta = await lancar(tenant.operator, contagem.id, tenant.productId, 11)
    assert.equal(resposta.statusCode, 422)
    assert.equal(resposta.json().error.code, 'COUNT_NOT_OPEN')
  })
})

describe('abertura da contagem', () => {
  test('só uma contagem em aberto por empresa', async () => {
    const tenant = await createTenant('contagem-unica', '18')
    await abrirContagem(tenant.admin)

    const segunda = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-counts',
      headers: comoUsuario(tenant.admin),
      payload: {},
    })
    assert.equal(segunda.statusCode, 409)
  })

  test('contagem por categoria só junta os produtos daquela categoria', async () => {
    const tenant = await createTenant('contagem-categoria', '18')
    const [outra] = await db
      .insert(products)
      .values({
        companyId: tenant.companyId,
        categoryId: tenant.categoryId,
        unitId: tenant.unitId,
        name: 'Produto irmão',
        currentStock: '3',
        createdBy: tenant.admin.id,
      })
      .returning({ id: products.id })

    const contagem = await abrirContagem(tenant.admin, { categoryId: tenant.categoryId })
    const itens = (await listarItens(tenant.admin, contagem.id)).json().data as ItemDaContagem[]

    assert.equal(itens.length, 2)
    assert.ok(itens.some((item) => item.productId === outra.id))
  })

  test('produto inativo fica de fora', async () => {
    const tenant = await createTenant('contagem-inativo', '18')
    await db.update(products).set({ active: false }).where(eq(products.id, tenant.productId))

    const resposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-counts',
      headers: comoUsuario(tenant.admin),
      payload: {},
    })
    assert.equal(resposta.statusCode, 422)
    assert.equal(resposta.json().error.code, 'NO_PRODUCTS_TO_COUNT')
  })

  test('contagem em aberto é encontrada sem saber o identificador', async () => {
    const tenant = await createTenant('contagem-aberta', '18')
    const contagem = await abrirContagem(tenant.admin)

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/stock-counts/open',
      headers: comoUsuario(tenant.operator),
    })
    assert.equal(resposta.statusCode, 200)
    assert.equal(resposta.json().id, contagem.id)
  })

  test('sem contagem em aberto a resposta é vazia, não erro', async () => {
    const tenant = await createTenant('contagem-sem-aberta', '18')

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/stock-counts/open',
      headers: comoUsuario(tenant.admin),
    })
    assert.equal(resposta.statusCode, 200)
    assert.equal(resposta.json(), null)
  })
})

describe('encerramento da contagem', () => {
  test('o estoque passa a ser o que foi contado e o ajuste fica no histórico', async () => {
    const tenant = await createTenant('contagem-encerra', '18')
    await db.update(products).set({ costPrice: '7.00' }).where(eq(products.id, tenant.productId))
    const contagem = await abrirContagem(tenant.admin)
    await lancar(tenant.operator, contagem.id, tenant.productId, 14)
    await acao(tenant.admin, contagem.id, 'review')

    const resposta = await acao(tenant.admin, contagem.id, 'finish')
    assert.equal(resposta.statusCode, 200)
    assert.equal(resposta.json().status, 'concluida')
    assert.equal(resposta.json().resumo.negativeValue, 28)

    const [produto] = await db
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, tenant.productId))
    assert.equal(produto.currentStock, '14.000')

    const movimentos = await db
      .select({ type: stockMovements.type, quantity: stockMovements.quantity, referenceType: stockMovements.referenceType })
      .from(stockMovements)
      .where(eq(stockMovements.productId, tenant.productId))
    assert.equal(movimentos.length, 1)
    assert.equal(movimentos[0].type, 'ajuste')
    assert.equal(movimentos[0].quantity, '-4.000')
    assert.equal(movimentos[0].referenceType, 'stock_count')
  })

  test('produto não contado não recebe ajuste nenhum', async () => {
    const tenant = await createTenant('contagem-nao-contado', '18')
    const naoContado = await criarProduto(tenant, 'Produto esquecido', '9', '1.00')
    const contagem = await abrirContagem(tenant.admin)

    await lancar(tenant.operator, contagem.id, tenant.productId, 18)
    await acao(tenant.admin, contagem.id, 'review')
    await acao(tenant.admin, contagem.id, 'finish')

    const [produto] = await db
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, naoContado))
    assert.equal(produto.currentStock, '9.000', 'produto não contado não pode ser zerado')

    const movimentos = await db.select({ id: stockMovements.id }).from(stockMovements)
    assert.equal(movimentos.length, 0, 'contagem que bateu não deveria gerar movimentação')
  })

  test('o relatório congela: mexer no custo depois não muda a divergência', async () => {
    const tenant = await createTenant('contagem-congela', '18')
    await db.update(products).set({ costPrice: '7.00' }).where(eq(products.id, tenant.productId))
    const contagem = await abrirContagem(tenant.admin)
    await lancar(tenant.operator, contagem.id, tenant.productId, 14)
    await acao(tenant.admin, contagem.id, 'review')
    await acao(tenant.admin, contagem.id, 'finish')

    await db.update(products).set({ costPrice: '99.00', currentStock: '1' }).where(eq(products.id, tenant.productId))

    const [item] = (await listarItens(tenant.admin, contagem.id)).json().data as ItemDaContagem[]
    assert.equal(item.previousQuantity, '18.000')
    assert.equal(item.unitCost, '7.00')
    assert.equal(item.differenceValue, -28)
  })

  test('produto não contado não ganha saldo emprestado do estoque de hoje', async () => {
    const tenant = await createTenant('contagem-nao-conferido', '18')
    const naoContado = await criarProduto(tenant, 'Produto esquecido', '9', '1.00')
    const contagem = await abrirContagem(tenant.admin)

    await lancar(tenant.operator, contagem.id, tenant.productId, 14)
    await acao(tenant.admin, contagem.id, 'review')
    await acao(tenant.admin, contagem.id, 'finish')

    await db.update(products).set({ currentStock: '777' }).where(eq(products.id, naoContado))

    const itens = (await listarItens(tenant.admin, contagem.id)).json().data as ItemDaContagem[]
    const linha = itens.find((item) => item.productId === naoContado)
    assert.ok(linha, 'o produto não contado deveria continuar na lista da contagem')
    assert.equal(linha.countedQuantity, null)
    assert.equal(linha.previousQuantity, null, 'relatório encerrado não pode mostrar o estoque de hoje')
    assert.equal(linha.difference, null)
  })

  test('em conferência o saldo mostrado é o de agora, que é o que o ajuste vai corrigir', async () => {
    const tenant = await createTenant('contagem-saldo-vivo', '18')
    const contagem = await abrirContagem(tenant.admin)
    await lancar(tenant.operator, contagem.id, tenant.productId, 14)
    await acao(tenant.admin, contagem.id, 'review')

    await db.update(products).set({ currentStock: '20' }).where(eq(products.id, tenant.productId))

    const [item] = (await listarItens(tenant.admin, contagem.id)).json().data as ItemDaContagem[]
    assert.equal(item.previousQuantity, '20.000')
    assert.equal(item.difference, -6)
  })

  test('conferir sem ter contado nada é recusado', async () => {
    const tenant = await createTenant('contagem-vazia', '18')
    const contagem = await abrirContagem(tenant.admin)

    const resposta = await acao(tenant.admin, contagem.id, 'review')
    assert.equal(resposta.statusCode, 422)
    assert.equal(resposta.json().error.code, 'NOTHING_COUNTED')
  })

  test('encerrar duas vezes não aplica o ajuste de novo', async () => {
    const tenant = await createTenant('contagem-duas-vezes', '18')
    const contagem = await abrirContagem(tenant.admin)
    await lancar(tenant.operator, contagem.id, tenant.productId, 14)
    await acao(tenant.admin, contagem.id, 'review')
    await acao(tenant.admin, contagem.id, 'finish')

    const segunda = await acao(tenant.admin, contagem.id, 'finish')
    assert.equal(segunda.statusCode, 422)
    assert.equal(segunda.json().error.code, 'COUNT_ALREADY_CLOSED')

    const [produto] = await db
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, tenant.productId))
    assert.equal(produto.currentStock, '14.000')
  })

  test('cancelar não mexe no estoque e guarda o motivo', async () => {
    const tenant = await createTenant('contagem-cancela', '18')
    const contagem = await abrirContagem(tenant.admin)
    await lancar(tenant.operator, contagem.id, tenant.productId, 14)

    const resposta = await acao(tenant.admin, contagem.id, 'cancel', { cancelReason: 'Contamos a banca errada' })
    assert.equal(resposta.statusCode, 200)
    assert.equal(resposta.json().status, 'cancelada')
    assert.equal(resposta.json().cancelReason, 'Contamos a banca errada')

    const [produto] = await db
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, tenant.productId))
    assert.equal(produto.currentStock, '18.000')
  })

  test('cancelar libera a empresa para abrir outra contagem', async () => {
    const tenant = await createTenant('contagem-libera', '18')
    const primeira = await abrirContagem(tenant.admin)
    await acao(tenant.admin, primeira.id, 'cancel', { cancelReason: 'Começamos de novo' })

    const segunda = await abrirContagem(tenant.admin)
    assert.notEqual(segunda.id, primeira.id)
  })
})

describe('histórico de contagens', () => {
  test('a lista traz o progresso de cada contagem', async () => {
    const tenant = await createTenant('contagem-historico', '18')
    await criarProduto(tenant, 'Segundo produto', '5', '2.00')
    const contagem = await abrirContagem(tenant.admin)
    await lancar(tenant.operator, contagem.id, tenant.productId, 10)

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/stock-counts?page=1&pageSize=10',
      headers: comoUsuario(tenant.admin),
    })

    assert.equal(resposta.statusCode, 200)
    const [linha] = resposta.json().data as { itemsCount: number; countedCount: number; status: string }[]
    assert.equal(linha.itemsCount, 2)
    assert.equal(linha.countedCount, 1)
    assert.equal(linha.status, 'em_andamento')
  })

  test('ordenar por situação segue o rótulo da tela, não a ordem do enum', async () => {
    const tenant = await createTenant('contagem-ordem', '18')
    const primeira = await abrirContagem(tenant.admin)
    await acao(tenant.admin, primeira.id, 'cancel', { cancelReason: 'primeira' })
    const segunda = await abrirContagem(tenant.admin)
    await lancar(tenant.operator, segunda.id, tenant.productId, 18)
    await acao(tenant.admin, segunda.id, 'review')
    await acao(tenant.admin, segunda.id, 'finish')
    await abrirContagem(tenant.admin)

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/stock-counts?page=1&pageSize=10&sortBy=status&sortOrder=asc',
      headers: comoUsuario(tenant.admin),
    })

    const situacoes = (resposta.json().data as { id: string; status: string }[]).map((linha) => linha.status)
    assert.deepEqual(situacoes, ['cancelada', 'concluida', 'em_andamento'])
  })
})

describe('permissões da contagem', () => {
  test('operador conta, mas não abre nem encerra', async () => {
    const tenant = await createTenant('contagem-permissao', '18')

    const abertura = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-counts',
      headers: comoUsuario(tenant.operator),
      payload: {},
    })
    assert.equal(abertura.statusCode, 403)

    const contagem = await abrirContagem(tenant.admin)
    assert.equal((await lancar(tenant.operator, contagem.id, tenant.productId, 14)).statusCode, 200)
    assert.equal((await acao(tenant.operator, contagem.id, 'review')).statusCode, 403)
    assert.equal((await acao(tenant.operator, contagem.id, 'finish')).statusCode, 403)
    assert.equal((await acao(tenant.operator, contagem.id, 'cancel', { cancelReason: 'x' })).statusCode, 403)
  })

  test('contagem de outra empresa não é alcançada', async () => {
    const minha = await createTenant('contagem-rls-a', '18')
    const vizinha = await createTenant('contagem-rls-b', '18')
    const daVizinha = await abrirContagem(vizinha.admin)

    const leitura = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-counts/${daVizinha.id}`,
      headers: comoUsuario(minha.admin),
    })
    assert.equal(leitura.statusCode, 404)

    const itens = await comEscopoDaEmpresa(minha.companyId, () =>
      dbDaAplicacao.select({ id: stockCountItems.id }).from(stockCountItems),
    )
    assert.equal(itens.length, 0, 'item de contagem de outra empresa apareceu')

    const contagens = await comEscopoDaEmpresa(minha.companyId, () =>
      dbDaAplicacao.select({ id: stockCounts.id }).from(stockCounts),
    )
    assert.equal(contagens.length, 0)
  })
})
