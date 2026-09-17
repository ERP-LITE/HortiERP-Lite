import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { categories, products, stockCountItems, stockCounts, units, users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { applyStockMovement } from '../../shared/db/applyStockMovement.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { orderByColumn, orderByLabeledEnum, STOCK_COUNT_STATUS_LABEL_ORDER } from '../../shared/db/sorting.js'
import { recordActivitySafe } from '../../shared/db/recordActivity.js'
import { uniqueViolationConstraint } from '../../shared/db/uniqueConstraints.js'
import { arredondarQuantidade, divergenciaDaLinha, resumoDaContagem } from './divergencia.js'
import type {
  CancelStockCountInput,
  CreateStockCountInput,
  ListStockCountItemsQuery,
  ListStockCountsQuery,
  StockCountStatus,
} from './stock-counts.schema.js'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const STATUS_ABERTOS: StockCountStatus[] = ['em_andamento', 'em_conferencia']

/**
 * A contagem cega vive nesta linha: enquanto está `em_andamento` a API não devolve saldo, custo nem
 * divergência, porque quem enxerga o número que o sistema espera acaba digitando ele de volta.
 */
function estaRevelada(status: StockCountStatus) {
  return status !== 'em_andamento'
}

/**
 * Em conferência a referência ainda não foi congelada, e o que vale é o saldo de agora, porque é
 * exatamente ele que o ajuste vai corrigir. Depois de encerrada só o congelado responde: cair no
 * estoque atual faria a coluna "Sistema tinha" mostrar o saldo de hoje num relatório de meses atrás,
 * e faria o produto que ninguém contou parecer conferido.
 */
function referenciaDaContagem(status: StockCountStatus) {
  if (status !== 'em_conferencia') {
    return { saldo: stockCountItems.previousQuantity, custo: stockCountItems.unitCost }
  }

  return {
    saldo: sql<string | null>`coalesce(${stockCountItems.previousQuantity}, ${products.currentStock})`,
    custo: sql<string | null>`coalesce(${stockCountItems.unitCost}, ${products.costPrice})`,
  }
}

function contagemNaoEncontrada() {
  return AppError.notFound('Contagem não encontrada')
}

async function buscarContagem(companyId: string, id: string) {
  const [contagem] = await db
    .select({
      id: stockCounts.id,
      status: stockCounts.status,
      categoryId: stockCounts.categoryId,
      categoryName: categories.name,
      notes: stockCounts.notes,
      cancelReason: stockCounts.cancelReason,
      startedAt: stockCounts.startedAt,
      finishedAt: stockCounts.finishedAt,
      createdByUser: { id: users.id, name: users.name },
    })
    .from(stockCounts)
    .leftJoin(categories, eq(categories.id, stockCounts.categoryId))
    .leftJoin(users, eq(users.id, stockCounts.createdBy))
    .where(and(eq(stockCounts.id, id), eq(stockCounts.companyId, companyId)))

  if (!contagem) throw contagemNaoEncontrada()

  return contagem
}

async function linhasDaContagem(companyId: string, countId: string, status: StockCountStatus) {
  const referencia = referenciaDaContagem(status)
  return db
    .select({
      countedQuantity: stockCountItems.countedQuantity,
      previousQuantity: referencia.saldo,
      unitCost: referencia.custo,
    })
    .from(stockCountItems)
    .innerJoin(products, eq(products.id, stockCountItems.productId))
    .where(and(eq(stockCountItems.stockCountId, countId), eq(products.companyId, companyId)))
}

/** Enquanto está cega, o resumo só conta quanto falta contar: valor e divergência ficam de fora. */
async function montarResumo(companyId: string, countId: string, status: StockCountStatus) {
  const linhas = await linhasDaContagem(companyId, countId, status)
  const resumo = resumoDaContagem(linhas)
  if (estaRevelada(status)) return resumo

  return {
    ...resumo,
    divergentCount: 0,
    positiveValue: 0,
    negativeValue: 0,
    netValue: 0,
  }
}

export async function listStockCounts(companyId: string, query: ListStockCountsQuery) {
  const conditions = [eq(stockCounts.companyId, companyId)]
  if (query.status) conditions.push(eq(stockCounts.status, query.status))
  const where = and(...conditions)
  const orderBy =
    query.sortBy === 'status'
      ? orderByLabeledEnum(stockCounts.status, STOCK_COUNT_STATUS_LABEL_ORDER, query.sortOrder)
      : orderByColumn(query.sortBy ? stockCounts[query.sortBy] : stockCounts.startedAt, query.sortOrder, 'desc')

  const [data, [{ total }]] = await Promise.all([
    db
      .select({
        id: stockCounts.id,
        status: stockCounts.status,
        categoryId: stockCounts.categoryId,
        categoryName: categories.name,
        notes: stockCounts.notes,
        startedAt: stockCounts.startedAt,
        finishedAt: stockCounts.finishedAt,
        createdByUser: { id: users.id, name: users.name },
        itemsCount: sql<number>`(
          select count(*)::int from ${stockCountItems} where ${stockCountItems.stockCountId} = ${stockCounts.id}
        )`,
        countedCount: sql<number>`(
          select count(*)::int from ${stockCountItems}
          where ${stockCountItems.stockCountId} = ${stockCounts.id} and ${stockCountItems.countedQuantity} is not null
        )`,
      })
      .from(stockCounts)
      .leftJoin(categories, eq(categories.id, stockCounts.categoryId))
      .leftJoin(users, eq(users.id, stockCounts.createdBy))
      .where(where)
      .orderBy(orderBy, desc(stockCounts.startedAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(stockCounts).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

async function idDaContagemAberta(companyId: string) {
  const [aberta] = await db
    .select({ id: stockCounts.id })
    .from(stockCounts)
    .where(and(eq(stockCounts.companyId, companyId), inArray(stockCounts.status, STATUS_ABERTOS)))

  return aberta?.id ?? null
}

export async function getOpenStockCount(companyId: string) {
  const id = await idDaContagemAberta(companyId)
  return id ? getStockCount(companyId, id) : null
}

export async function getStockCount(companyId: string, id: string) {
  const contagem = await buscarContagem(companyId, id)
  const revelada = estaRevelada(contagem.status)

  return { ...contagem, revelada, resumo: await montarResumo(companyId, contagem.id, contagem.status) }
}

export async function createStockCount(companyId: string, userId: string, data: CreateStockCountInput) {
  if (await idDaContagemAberta(companyId)) {
    throw AppError.conflict('Já existe uma contagem em aberto. Encerre ou cancele essa contagem antes de iniciar outra')
  }

  const condicoesDoProduto = [eq(products.companyId, companyId), isNull(products.deletedAt), eq(products.active, true)]
  if (data.categoryId) condicoesDoProduto.push(eq(products.categoryId, data.categoryId))

  const alvos = await db
    .select({ id: products.id })
    .from(products)
    .where(and(...condicoesDoProduto))

  if (alvos.length === 0) {
    throw new AppError('Nenhum produto ativo para contar com esse filtro', 422, 'NO_PRODUCTS_TO_COUNT')
  }

  const contagem = await db
    .transaction(async (tx) => {
      const [criada] = await tx
        .insert(stockCounts)
        .values({ companyId, categoryId: data.categoryId ?? null, notes: data.notes || null, createdBy: userId })
        .returning()

      await tx.insert(stockCountItems).values(alvos.map((alvo) => ({ stockCountId: criada.id, productId: alvo.id })))

      return criada
    })
    .catch((error: unknown) => {
      // Duas pessoas abrindo a contagem no mesmo instante: o índice parcial recusa a segunda.
      if (uniqueViolationConstraint(error) === 'stock_counts_uma_aberta_por_empresa') {
        throw AppError.conflict('Outra pessoa acabou de iniciar uma contagem nesta empresa')
      }
      throw error
    })

  await recordActivitySafe({
    companyId,
    actorId: userId,
    action: 'criou',
    entity: 'contagem',
    entityId: contagem.id,
    entityLabel: 'Contagem de estoque',
    details: { produtos: alvos.length },
  })

  return getStockCount(companyId, contagem.id)
}

export async function listStockCountItems(companyId: string, id: string, query: ListStockCountItemsQuery) {
  const contagem = await buscarContagem(companyId, id)
  const revelada = estaRevelada(contagem.status)

  // Filtrar por divergência numa contagem cega apontaria, um a um, quais produtos não batem. Seria a
  // mesma informação que esconder o saldo evita entregar.
  if (query.situacao === 'divergentes' && !revelada) {
    throw new AppError('A divergência só aparece depois que a contagem vai para conferência', 422, 'COUNT_STILL_BLIND')
  }

  const referencia = referenciaDaContagem(contagem.status)
  const conditions = [eq(stockCountItems.stockCountId, id)]
  if (query.search) conditions.push(ilike(products.name, `%${query.search}%`))
  if (query.situacao === 'pendentes') conditions.push(isNull(stockCountItems.countedQuantity))
  if (query.situacao === 'contados') conditions.push(isNotNull(stockCountItems.countedQuantity))
  if (query.situacao === 'divergentes') {
    conditions.push(isNotNull(stockCountItems.countedQuantity))
    conditions.push(sql`${stockCountItems.countedQuantity} <> ${referencia.saldo}`)
  }
  const where = and(...conditions)

  const [linhas, [{ total }]] = await Promise.all([
    db
      .select({
        productId: stockCountItems.productId,
        productName: products.name,
        sku: products.sku,
        barcode: products.barcode,
        categoryName: categories.name,
        unitAbbreviation: units.abbreviation,
        countedQuantity: stockCountItems.countedQuantity,
        countedAt: stockCountItems.countedAt,
        previousQuantity: referencia.saldo,
        unitCost: referencia.custo,
      })
      .from(stockCountItems)
      .innerJoin(products, eq(products.id, stockCountItems.productId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .innerJoin(units, eq(units.id, products.unitId))
      .where(where)
      // Categoria antes do nome: quem conta anda por seção, não por ordem alfabética da loja toda.
      .orderBy(asc(categories.name), asc(products.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ total: count() })
      .from(stockCountItems)
      .innerJoin(products, eq(products.id, stockCountItems.productId))
      .where(where),
  ])

  const data = linhas.map((linha) => {
    if (!revelada) {
      return {
        ...linha,
        previousQuantity: null,
        unitCost: null,
        difference: null,
        differenceValue: null,
      }
    }

    return { ...linha, ...divergenciaDaLinha(linha) }
  })

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function countStockCountItem(
  companyId: string,
  userId: string,
  id: string,
  productId: string,
  countedQuantity: number | null,
) {
  const contagem = await buscarContagem(companyId, id)
  if (contagem.status !== 'em_andamento') {
    throw new AppError('Esta contagem não aceita mais lançamentos', 422, 'COUNT_NOT_OPEN')
  }

  const contado = countedQuantity !== null
  const [item] = await db
    .update(stockCountItems)
    .set({
      countedQuantity: contado ? countedQuantity.toString() : null,
      countedAt: contado ? new Date() : null,
      countedBy: contado ? userId : null,
    })
    .where(and(eq(stockCountItems.stockCountId, id), eq(stockCountItems.productId, productId)))
    .returning({ countedQuantity: stockCountItems.countedQuantity, countedAt: stockCountItems.countedAt })

  if (!item) throw AppError.notFound('Este produto não faz parte da contagem')

  return { productId, ...item }
}

async function trocarStatus(
  companyId: string,
  userId: string,
  id: string,
  de: StockCountStatus[],
  para: StockCountStatus,
) {
  const [contagem] = await db
    .update(stockCounts)
    .set({ status: para, updatedBy: userId, updatedAt: new Date() })
    .where(and(eq(stockCounts.id, id), eq(stockCounts.companyId, companyId), inArray(stockCounts.status, de)))
    .returning({ id: stockCounts.id })

  return contagem
}

export async function reviewStockCount(companyId: string, userId: string, id: string) {
  await buscarContagem(companyId, id)

  const [{ contados }] = await db
    .select({ contados: count() })
    .from(stockCountItems)
    .where(and(eq(stockCountItems.stockCountId, id), isNotNull(stockCountItems.countedQuantity)))

  if (contados === 0) {
    throw new AppError('Conte ao menos um produto antes de conferir', 422, 'NOTHING_COUNTED')
  }

  const contagem = await trocarStatus(companyId, userId, id, ['em_andamento'], 'em_conferencia')
  if (!contagem) throw new AppError('Esta contagem não está mais em andamento', 422, 'COUNT_NOT_OPEN')

  return getStockCount(companyId, id)
}

export async function reopenStockCount(companyId: string, userId: string, id: string) {
  await buscarContagem(companyId, id)

  const contagem = await trocarStatus(companyId, userId, id, ['em_conferencia'], 'em_andamento')
  if (!contagem) throw new AppError('Só uma contagem em conferência pode voltar a ser contada', 422, 'COUNT_NOT_REVIEW')

  return getStockCount(companyId, id)
}

/**
 * Congela saldo e custo de tudo que foi contado, inclusive do que bateu: é o que permite reabrir o
 * relatório meses depois e ver os mesmos números. Produto excluído no meio da contagem fica de fora
 * aqui e no ajuste, e por isso aparece no relatório como não conferido.
 */
async function congelarReferencia(tx: Transaction, companyId: string, id: string) {
  await tx.execute(sql`
    update ${stockCountItems}
    set previous_quantity = ${products.currentStock}, unit_cost = ${products.costPrice}
    from ${products}
    where ${products.id} = ${stockCountItems.productId}
      and ${products.companyId} = ${companyId}
      and ${products.deletedAt} is null
      and ${stockCountItems.stockCountId} = ${id}
      and ${stockCountItems.countedQuantity} is not null
  `)
}

async function travarContagem(tx: Transaction, companyId: string, id: string, status: StockCountStatus[]) {
  const [contagem] = await tx
    .select({ id: stockCounts.id, status: stockCounts.status, notes: stockCounts.notes })
    .from(stockCounts)
    .where(and(eq(stockCounts.id, id), eq(stockCounts.companyId, companyId)))
    .for('update')

  if (!contagem) throw contagemNaoEncontrada()
  if (!status.includes(contagem.status)) {
    throw new AppError('Esta contagem já foi encerrada', 422, 'COUNT_ALREADY_CLOSED')
  }

  return contagem
}

export async function finishStockCount(companyId: string, userId: string, id: string) {
  const aplicados = await db.transaction(async (tx) => {
    const contagem = await travarContagem(tx, companyId, id, ['em_conferencia'])

    // Trava as linhas de produto antes de congelar: sem isso uma entrada lançada entre o congelamento
    // e o ajuste faria o relatório mostrar uma diferença e o estoque receber outra.
    const contados = await tx
      .select({
        productId: stockCountItems.productId,
        countedQuantity: stockCountItems.countedQuantity,
        currentStock: products.currentStock,
      })
      .from(stockCountItems)
      .innerJoin(products, eq(products.id, stockCountItems.productId))
      .where(
        and(
          eq(stockCountItems.stockCountId, id),
          isNotNull(stockCountItems.countedQuantity),
          eq(products.companyId, companyId),
          isNull(products.deletedAt),
        ),
      )
      .orderBy(asc(stockCountItems.productId))
      .for('update', { of: products })

    await congelarReferencia(tx, companyId, id)

    let ajustes = 0
    for (const item of contados) {
      const delta = arredondarQuantidade(Number(item.countedQuantity) - Number(item.currentStock))
      if (delta === 0) continue

      await applyStockMovement(tx, {
        companyId,
        userId,
        productId: item.productId,
        delta,
        type: 'ajuste',
        referenceType: 'stock_count',
        referenceId: id,
        notes: contagem.notes ?? 'Contagem de estoque',
      })
      ajustes += 1
    }

    await tx
      .update(stockCounts)
      .set({ status: 'concluida', finishedAt: new Date(), updatedBy: userId, updatedAt: new Date() })
      .where(eq(stockCounts.id, id))

    return ajustes
  })

  await recordActivitySafe({
    companyId,
    actorId: userId,
    action: 'ajustou',
    entity: 'contagem',
    entityId: id,
    entityLabel: 'Contagem de estoque',
    details: { produtosAjustados: aplicados },
  })

  return getStockCount(companyId, id)
}

export async function cancelStockCount(companyId: string, userId: string, id: string, data: CancelStockCountInput) {
  await db.transaction(async (tx) => {
    await travarContagem(tx, companyId, id, STATUS_ABERTOS)
    // Congela mesmo sem aplicar ajuste: o relatório da contagem cancelada precisa continuar
    // mostrando a divergência que existia quando alguém decidiu não seguir com ela.
    await congelarReferencia(tx, companyId, id)
    await tx
      .update(stockCounts)
      .set({
        status: 'cancelada',
        cancelReason: data.cancelReason,
        finishedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(stockCounts.id, id))
  })

  await recordActivitySafe({
    companyId,
    actorId: userId,
    action: 'cancelou',
    entity: 'contagem',
    entityId: id,
    entityLabel: 'Contagem de estoque',
    details: { motivo: data.cancelReason },
  })

  return getStockCount(companyId, id)
}
