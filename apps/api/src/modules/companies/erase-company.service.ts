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
import { env } from '../../shared/config/env.js'

/**
 * Exclusão definitiva dos dados de uma empresa — o que a LGPD (arts. 15 e 16) exige quando a
 * finalidade do tratamento termina, tipicamente no encerramento do contrato. Diferente do
 * `softDelete` usado no dia a dia: aqui a linha sai do banco e o arquivo sai do disco.
 */

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

export async function collectCompanyFootprint(companyId: string): Promise<CompanyFootprint | null> {
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
  const { company, entryIds, storedNames } = footprint

  await db.transaction(async (tx) => {
    // Ordem obrigatória: as chaves estrangeiras não têm ON DELETE CASCADE, então cada tabela filha
    // sai antes daquela que ela referencia. `stock_entry_items` não tem `companyId` — chega pela
    // entrada a que pertence.
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

  // Só depois do commit. Se a transação abortasse com os arquivos já apagados, a nota fiscal
  // estaria perdida com o registro dela intacto. Arquivo sobrando é recuperável pelo
  // `invoices:cleanup`; arquivo apagado por engano, não.
  let removedFiles = 0
  for (const storedName of storedNames) {
    await rm(join(env.INVOICE_STORAGE_PATH, storedName), { force: true })
    removedFiles += 1
  }

  return { removedFiles }
}
