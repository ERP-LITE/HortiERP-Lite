import { and, count, desc, eq, gte, ilike, inArray, isNull, lte, or } from 'drizzle-orm'
import { LOSS_REASON_LABEL_ORDER, orderByColumn, orderByLabeledEnum } from '../../shared/db/sorting.js'
import { db } from '../../db/client.js'
import { losses, products } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { applyStockMovement } from '../../shared/db/applyStockMovement.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { matchingProductIds } from '../../shared/db/matchingProductIds.js'
import { recordActivity, recordActivitySafe } from '../../shared/db/recordActivity.js'
import type { CancelLossInput, CreateLossInput, ListLossesQuery, UpdateLossInput } from './losses.schema.js'

export function buildLossesConditions(
  companyId: string,
  query: Pick<ListLossesQuery, 'search' | 'productId' | 'reason' | 'from' | 'to'> & { includeCancelled?: boolean },
) {
  const conditions = [eq(losses.companyId, companyId)]
  if (!query.includeCancelled) conditions.push(isNull(losses.cancelledAt))
  if (query.search) {
    conditions.push(
      or(ilike(losses.notes, `%${query.search}%`), inArray(losses.productId, matchingProductIds(companyId, query.search)))!,
    )
  }
  if (query.productId) conditions.push(eq(losses.productId, query.productId))
  if (query.reason) conditions.push(eq(losses.reason, query.reason))
  if (query.from) conditions.push(gte(losses.lossDate, query.from))
  if (query.to) conditions.push(lte(losses.lossDate, query.to))
  return conditions
}

export async function listLosses(companyId: string, query: ListLossesQuery) {
  const where = and(...buildLossesConditions(companyId, query))
  const lossOrderBy =
    query.sortBy === 'reason'
      ? orderByLabeledEnum(losses.reason, LOSS_REASON_LABEL_ORDER, query.sortOrder)
      : orderByColumn(query.sortBy ? losses[query.sortBy] : losses.lossDate, query.sortOrder, 'desc')

  const [data, [{ total }]] = await Promise.all([
    db.query.losses.findMany({
      where,
      with: {
        createdByUser: { columns: { id: true, name: true } },
        product: true,
      },
      orderBy: [lossOrderBy, desc(losses.lossDate)],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(losses).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function getLoss(companyId: string, id: string) {
  const loss = await db.query.losses.findFirst({
    where: and(eq(losses.id, id), eq(losses.companyId, companyId)),
    with: {
      createdByUser: { columns: { id: true, name: true } },
      product: true,
    },
  })

  if (!loss) throw AppError.notFound('Registro de perda não encontrado')

  return loss
}

export async function createLoss(companyId: string, userId: string, data: CreateLossInput) {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ costPrice: products.costPrice })
      .from(products)
      .where(and(eq(products.id, data.productId), eq(products.companyId, companyId), isNull(products.deletedAt)))

    if (!product) throw AppError.notFound(`Produto não encontrado: ${data.productId}`)

    const [loss] = await tx
      .insert(losses)
      .values({
        companyId,
        productId: data.productId,
        quantity: data.quantity.toString(),
        unitCost: product.costPrice,
        reason: data.reason,
        notes: data.notes,
        lossDate: data.lossDate ?? new Date(),
        createdBy: userId,
      })
      .returning()

    await applyStockMovement(tx, {
      companyId,
      userId,
      productId: data.productId,
      delta: -data.quantity,
      type: 'perda',
      referenceType: 'loss',
      referenceId: loss.id,
      requireSufficientStock: true,
    })

    return loss
  })
}

export async function updateLoss(companyId: string, userId: string, id: string, data: UpdateLossInput) {
  const current = await getLoss(companyId, id)

  if (current.cancelledAt) {
    throw AppError.conflict('Esta perda foi cancelada e não pode mais ser alterada')
  }

  await db
    .update(losses)
    .set({
      ...(data.reason !== undefined && { reason: data.reason }),
      ...(data.notes !== undefined && { notes: data.notes }),
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(losses.id, id), eq(losses.companyId, companyId)))

  await recordActivitySafe({
    companyId,
    actorId: userId,
    action: 'alterou',
    entity: 'perda',
    entityId: id,
    entityLabel: current.product?.name ?? 'Perda',
    details: {
      ...(data.reason !== undefined && { motivo: data.reason }),
      ...(data.notes !== undefined && { observacoes: data.notes }),
    },
  })

  return getLoss(companyId, id)
}

export async function cancelLoss(companyId: string, userId: string, id: string, data: CancelLossInput) {
  await db.transaction(async (tx) => {
    const [loss] = await tx
      .select({
        id: losses.id,
        productId: losses.productId,
        quantity: losses.quantity,
        cancelledAt: losses.cancelledAt,
      })
      .from(losses)
      .where(and(eq(losses.id, id), eq(losses.companyId, companyId)))
      .for('update')

    if (!loss) throw AppError.notFound('Registro de perda não encontrado')
    if (loss.cancelledAt) throw AppError.conflict('Esta perda já foi cancelada')

    const cancelledAt = new Date()
    await tx
      .update(losses)
      .set({
        cancelledAt,
        cancelledBy: userId,
        cancelReason: data.cancelReason,
        updatedBy: userId,
        updatedAt: cancelledAt,
      })
      .where(eq(losses.id, id))

    await applyStockMovement(tx, {
      companyId,
      userId,
      productId: loss.productId,
      delta: Number(loss.quantity),
      type: 'ajuste',
      referenceType: 'loss_cancellation',
      referenceId: loss.id,
      notes: `Estorno de perda cancelada: ${data.cancelReason}`,
      allowDeletedProduct: true,
    })

    const [product] = await tx
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, loss.productId))

    await recordActivity(
      {
        companyId,
        actorId: userId,
        action: 'cancelou',
        entity: 'perda',
        entityId: loss.id,
        entityLabel: product?.name ?? 'Perda',
        details: { quantidadeEstornada: loss.quantity, motivo: data.cancelReason },
      },
      tx,
    )
  })

  // Fora da transação: `getLoss` usa outra conexão do pool e não veria a alteração
  // antes do commit.
  return getLoss(companyId, id)
}
