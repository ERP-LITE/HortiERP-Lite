import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { orderByColumn } from '../../shared/db/sorting.js'
import { db } from '../../db/client.js'
import { stockEntries, stockEntryAttachments, stockEntryItems } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { applyStockMovement } from '../../shared/db/applyStockMovement.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { matchingProductIds } from '../../shared/db/matchingProductIds.js'
import type {
  CreateStockEntryInput,
  ListStockEntriesQuery,
  UpdateStockEntryDetailsInput,
} from './stock-entries.schema.js'

const publicAttachmentColumns = {
  id: true,
  stockEntryId: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const

export async function listStockEntries(companyId: string, query: ListStockEntriesQuery) {
  const conditions = [eq(stockEntries.companyId, companyId)]
  if (query.search) {
    const matchingEntryIds = db
      .select({ id: stockEntryItems.stockEntryId })
      .from(stockEntryItems)
      .where(inArray(stockEntryItems.productId, matchingProductIds(companyId, query.search)))

    conditions.push(
      or(
        ilike(stockEntries.supplierName, `%${query.search}%`),
        ilike(stockEntries.invoiceNumber, `%${query.search}%`),
        ilike(stockEntries.invoiceAccessKey, `%${query.search}%`),
        inArray(stockEntries.id, matchingEntryIds),
      )!,
    )
  }
  if (query.from) conditions.push(gte(stockEntries.entryDate, query.from))
  if (query.to) conditions.push(lte(stockEntries.entryDate, query.to))
  const where = and(...conditions)
  // A subconsulta é escrita à mão de propósito: dentro de uma relational query, referência de coluna
  // de outra tabela (${stockEntryAttachments.stockEntryId}) sai com o alias da tabela raiz e o
  // Postgres recusa a consulta. Só as colunas de stockEntries podem vir do schema aqui.
  const invoiceStatus = sql<number>`(
    case
      when exists (
        select 1 from stock_entry_attachments anexo
        where anexo.stock_entry_id = ${stockEntries.id}
          and anexo.company_id = ${stockEntries.companyId}
      ) then 2
      when ${stockEntries.invoiceNumber} is not null or ${stockEntries.invoiceAccessKey} is not null then 1
      else 0
    end
  )`
  const entrySortColumns = {
    entryDate: stockEntries.entryDate,
    supplierName: stockEntries.supplierName,
    invoiceStatus,
    invoiceTotal: stockEntries.invoiceTotal,
  }
  const entryOrderBy = orderByColumn(
    query.sortBy ? entrySortColumns[query.sortBy] : stockEntries.entryDate,
    query.sortOrder,
    'desc',
  )

  const [data, [{ total }]] = await Promise.all([
    db.query.stockEntries.findMany({
      where,
      with: {
        createdByUser: { columns: { id: true, name: true } },
        items: { with: { product: { with: { unit: true } } } },
        attachments: { columns: { id: true } },
      },
      orderBy: [entryOrderBy, desc(stockEntries.entryDate)],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(stockEntries).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function getStockEntry(companyId: string, id: string) {
  const entry = await db.query.stockEntries.findFirst({
    where: and(eq(stockEntries.id, id), eq(stockEntries.companyId, companyId)),
    with: {
      createdByUser: { columns: { id: true, name: true } },
      items: { with: { product: { with: { unit: true } } } },
      attachments: { columns: publicAttachmentColumns },
    },
  })

  if (!entry) throw AppError.notFound('Entrada de mercadoria não encontrada')

  return entry
}

export async function createStockEntry(companyId: string, userId: string, data: CreateStockEntryInput) {
  return db.transaction(async (tx) => {
    const entryDate = data.entryDate ?? new Date()
    const [entry] = await tx
      .insert(stockEntries)
      .values({
        companyId,
        supplierName: data.supplierName,
        entryDate,
        notes: data.notes,
        invoiceNumber: data.invoiceNumber,
        invoiceSeries: data.invoiceSeries,
        invoiceAccessKey: data.invoiceAccessKey,
        invoiceIssuedAt: data.invoiceIssuedAt,
        invoiceTotal: data.invoiceTotal?.toString(),
        createdBy: userId,
      })
      .returning()

    for (const item of data.items) {
      await applyStockMovement(tx, {
        companyId,
        userId,
        productId: item.productId,
        delta: item.quantity,
        type: 'entrada',
        referenceType: 'stock_entry',
        referenceId: entry.id,
        movementDate: entryDate,
      })
    }

    await tx.insert(stockEntryItems).values(
      data.items.map((item) => ({
        stockEntryId: entry.id,
        productId: item.productId,
        quantity: item.quantity.toString(),
        unitCost: item.unitCost?.toString(),
      })),
    )

    return entry
  })
}

export async function updateStockEntryDetails(
  companyId: string,
  userId: string,
  id: string,
  data: UpdateStockEntryDetailsInput,
) {
  const [entry] = await db
    .update(stockEntries)
    .set({
      ...data,
      invoiceTotal: data.invoiceTotal === undefined ? undefined : data.invoiceTotal?.toString() ?? null,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(stockEntries.id, id), eq(stockEntries.companyId, companyId)))
    .returning({ id: stockEntries.id })

  if (!entry) throw AppError.notFound('Entrada de mercadoria não encontrada')
  return getStockEntry(companyId, id)
}

export async function getStockEntryAttachment(companyId: string, entryId: string, attachmentId: string) {
  const attachment = await db.query.stockEntryAttachments.findFirst({
    where: and(
      eq(stockEntryAttachments.id, attachmentId),
      eq(stockEntryAttachments.stockEntryId, entryId),
      eq(stockEntryAttachments.companyId, companyId),
    ),
  })

  if (!attachment) throw AppError.notFound('Anexo da nota fiscal não encontrado')
  return attachment
}

export async function deleteStockEntryAttachment(companyId: string, entryId: string, attachmentId: string) {
  const [attachment] = await db
    .delete(stockEntryAttachments)
    .where(
      and(
        eq(stockEntryAttachments.id, attachmentId),
        eq(stockEntryAttachments.stockEntryId, entryId),
        eq(stockEntryAttachments.companyId, companyId),
      ),
    )
    .returning({ storedName: stockEntryAttachments.storedName })

  if (!attachment) throw AppError.notFound('Anexo da nota fiscal não encontrado')
  return attachment
}
