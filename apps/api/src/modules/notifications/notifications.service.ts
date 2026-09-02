import { and, asc, count, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { losses, products, units } from '../../db/schema/index.js'
import { endOfBusinessDay, startOfBusinessDay, todayIsoDate } from '../../shared/utils/date.js'

/** Quantos produtos o painel do sino lista antes de mandar o usuário para a tela de estoque. */
export const MAX_PRODUTOS_NO_ALERTA = 5

export type AlertaDeProduto = {
  id: string
  name: string
  currentStock: string
  minStock: string
  unitAbbreviation: string
  status: 'sem_estoque' | 'abaixo_do_minimo'
}

export async function getOperationalAlerts(companyId: string) {
  const hoje = todayIsoDate()
  const inicioDoDia = startOfBusinessDay(hoje)
  const fimDoDia = endOfBusinessDay(hoje)

  const produtosAtivos = and(
    eq(products.companyId, companyId),
    isNull(products.deletedAt),
    eq(products.active, true),
  )

  // Mesma condição do filtro "somente estoque baixo" da tela de estoque: o sino e a tela
  // precisam mostrar exatamente o mesmo conjunto, senão o link do alerta abre outra lista.
  const precisaDeAtencao = and(produtosAtivos, lte(products.currentStock, products.minStock))

  const perdasDeHoje = and(
    eq(losses.companyId, companyId),
    isNull(losses.cancelledAt),
    gte(losses.lossDate, inicioDoDia),
    lte(losses.lossDate, fimDoDia),
  )

  const [[contagens], produtosCriticos, [perdas]] = await Promise.all([
    // Uma varredura só para as três contagens: o sino é consultado em intervalo fixo por
    // todo usuário logado, então cada consulta a mais aqui se multiplica pela sessão aberta.
    db
      .select({
        outOfStock: sql<number>`count(*) filter (where ${products.currentStock} <= 0)`.mapWith(Number),
        lowStock:
          sql<number>`count(*) filter (where ${products.currentStock} > 0 and ${products.currentStock} <= ${products.minStock})`.mapWith(
            Number,
          ),
        withoutMinStock: sql<number>`count(*) filter (where ${products.minStock} <= 0)`.mapWith(Number),
      })
      .from(products)
      .where(produtosAtivos),
    db
      .select({
        id: products.id,
        name: products.name,
        currentStock: products.currentStock,
        minStock: products.minStock,
        unitAbbreviation: units.abbreviation,
        status: sql<AlertaDeProduto['status']>`case
          when ${products.currentStock} <= 0 then 'sem_estoque'
          else 'abaixo_do_minimo'
        end`,
      })
      .from(products)
      .innerJoin(units, eq(units.id, products.unitId))
      .where(precisaDeAtencao)
      // Zerado primeiro, depois quem está mais longe do mínimo. O nome desempata para a
      // lista não trocar de ordem entre duas consultas com as mesmas quantidades.
      .orderBy(
        asc(sql`case when ${products.currentStock} <= 0 then 0 else 1 end`),
        asc(sql`${products.currentStock} - ${products.minStock}`),
        asc(products.name),
      )
      .limit(MAX_PRODUTOS_NO_ALERTA),
    db
      .select({
        count: count(),
        value:
          sql<number>`coalesce(sum(${losses.quantity} * coalesce(${losses.unitCost}, ${products.costPrice}, 0)), 0)`.mapWith(
            Number,
          ),
      })
      .from(losses)
      .innerJoin(products, eq(products.id, losses.productId))
      .where(perdasDeHoje),
  ])

  return {
    generatedAt: new Date().toISOString(),
    // Só o que pede ação entra no contador do sino. Perdas do dia e produtos sem mínimo
    // definido aparecem no painel como contexto, mas não fazem o número subir.
    total: contagens.outOfStock + contagens.lowStock,
    outOfStockCount: contagens.outOfStock,
    lowStockCount: contagens.lowStock,
    withoutMinStockCount: contagens.withoutMinStock,
    lossesToday: { count: perdas.count, value: perdas.value },
    products: produtosCriticos,
  }
}
