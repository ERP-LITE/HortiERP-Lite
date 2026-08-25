import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { count, eq, inArray } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { db } from '../../db/client.js'
import {
  activityLogs,
  categories,
  companies,
  companyBillings,
  losses,
  products,
  stockEntries,
  stockEntryAttachments,
  stockEntryItems,
  stockMovements,
  systemLogs,
  units,
  users,
} from '../../db/schema/index.js'
import { comEscopoDePlataforma } from '../../db/scope.js'
import { env } from '../../shared/config/env.js'

async function countBy(table: PgTable, column: PgColumn, value: string) {
  const [{ total }] = await db.select({ total: count() }).from(table).where(eq(column, value))
  return total
}

export interface CompanyFootprint {
  company: { id: string; name: string; document: string | null }
  entryIds: string[]
  storedNames: string[]
  volumes: Record<string, number>
}

// Travessia declarada: apagar uma empresa é ato de fora dela — sob escopo de empresa nem daria para
// encontrá-la.
export async function collectCompanyFootprint(companyId: string): Promise<CompanyFootprint | null> {
  return comEscopoDePlataforma(() => coletar(companyId))
}

async function coletar(companyId: string): Promise<CompanyFootprint | null> {
  const [company] = await db
    .select({ id: companies.id, name: companies.name, document: companies.document })
    .from(companies)
    .where(eq(companies.id, companyId))

  if (!company) return null

  const entryIds = (
    await db.select({ id: stockEntries.id }).from(stockEntries).where(eq(stockEntries.companyId, companyId))
  ).map((row) => row.id)

  const storedNames = (
    await db
      .select({ storedName: stockEntryAttachments.storedName })
      .from(stockEntryAttachments)
      .where(eq(stockEntryAttachments.companyId, companyId))
  ).map((row) => row.storedName)

  return {
    company,
    entryIds,
    storedNames,
    volumes: {
      usuarios: await countBy(users, users.companyId, companyId),
      produtos: await countBy(products, products.companyId, companyId),
      categorias: await countBy(categories, categories.companyId, companyId),
      unidades: await countBy(units, units.companyId, companyId),
      entradas: entryIds.length,
      anexos: storedNames.length,
      perdas: await countBy(losses, losses.companyId, companyId),
      movimentacoes: await countBy(stockMovements, stockMovements.companyId, companyId),
      logsAtividade: await countBy(activityLogs, activityLogs.companyId, companyId),
      logsTecnicos: await countBy(systemLogs, systemLogs.companyId, companyId),
      cobrancas: await countBy(companyBillings, companyBillings.companyId, companyId),
    },
  }
}

export async function eraseCompanyData(footprint: CompanyFootprint) {
  return comEscopoDePlataforma(() => apagar(footprint))
}

async function apagar(footprint: CompanyFootprint) {
  const { company, entryIds, storedNames } = footprint

  await db.transaction(async (tx) => {
    // Sem ON DELETE CASCADE: cada filha sai antes da que ela referencia. `stock_entry_items` não
    // tem `companyId` e só é alcançada pela entrada.
    if (entryIds.length > 0) {
      await tx.delete(stockEntryItems).where(inArray(stockEntryItems.stockEntryId, entryIds))
    }
    await tx.delete(stockEntryAttachments).where(eq(stockEntryAttachments.companyId, company.id))
    await tx.delete(stockEntries).where(eq(stockEntries.companyId, company.id))
    await tx.delete(losses).where(eq(losses.companyId, company.id))
    await tx.delete(stockMovements).where(eq(stockMovements.companyId, company.id))
    await tx.delete(products).where(eq(products.companyId, company.id))
    await tx.delete(categories).where(eq(categories.companyId, company.id))
    await tx.delete(units).where(eq(units.companyId, company.id))
    await tx.delete(activityLogs).where(eq(activityLogs.companyId, company.id))
    await tx.delete(systemLogs).where(eq(systemLogs.companyId, company.id))
    await tx.delete(companyBillings).where(eq(companyBillings.companyId, company.id))
    await tx.delete(users).where(eq(users.companyId, company.id))
    await tx.delete(companies).where(eq(companies.id, company.id))
  })

  // Só depois do commit: arquivo sobrando é recuperável pelo `invoices:cleanup`, apagado não.
  let removedFiles = 0
  for (const storedName of storedNames) {
    await rm(join(env.INVOICE_STORAGE_PATH, storedName), { force: true })
    removedFiles += 1
  }

  return { removedFiles }
}
