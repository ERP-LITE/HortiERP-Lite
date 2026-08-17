import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { products, stockMovements } from '../../db/schema/index.js'
import { AppError } from '../errors/AppError.js'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface ApplyStockMovementInput {
  companyId: string
  userId: string
  productId: string
  delta: number
  type: 'entrada' | 'perda' | 'ajuste'
  referenceType: string
  referenceId: string
  notes?: string
  requireSufficientStock?: boolean
  allowDeletedProduct?: boolean
}

export async function applyStockMovement(tx: Transaction, input: ApplyStockMovementInput) {
  const {
    companyId,
    userId,
    productId,
    delta,
    type,
    referenceType,
    referenceId,
    notes,
    requireSufficientStock,
    allowDeletedProduct,
  } = input
  const deltaStr = delta.toString()

  const productConditions = [eq(products.id, productId), eq(products.companyId, companyId)]
  if (!allowDeletedProduct) productConditions.push(isNull(products.deletedAt))

  // O `where` do update acrescenta a checagem de saldo; a busca do erro abaixo usa
  // só as condições do produto, para distinguir "não existe" de "sem saldo".
  const updateConditions = [...productConditions]
  if (requireSufficientStock && delta < 0) {
    updateConditions.push(gte(products.currentStock, (-delta).toString()))
  }

  const [updatedProduct] = await tx
    .update(products)
    .set({
      currentStock: sql`${products.currentStock} + ${deltaStr}`,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(and(...updateConditions))
    .returning({ currentStock: products.currentStock })

  if (!updatedProduct) {
    const [product] = await tx
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(and(...productConditions))

    if (!product) throw AppError.notFound(`Produto não encontrado: ${productId}`)

    throw new AppError(
      `Quantidade solicitada (${-delta}) maior que o estoque disponível (${product.currentStock})`,
      422,
      'INSUFFICIENT_STOCK',
    )
  }

  const [movement] = await tx
    .insert(stockMovements)
    .values({
      companyId,
      productId,
      type,
      quantity: deltaStr,
      balanceAfter: updatedProduct.currentStock,
      referenceType,
      referenceId,
      notes,
      createdBy: userId,
    })
    .returning()

  return movement
}
