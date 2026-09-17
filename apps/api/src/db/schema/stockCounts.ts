import { sql } from 'drizzle-orm'
import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { auditBy } from './columns.js'
import { categories } from './categories.js'
import { companies } from './companies.js'
import { products } from './products.js'
import { stockCountStatusEnum } from './enums.js'

/**
 * Sem exclusão lógica: contagem desistida vira `cancelada`, que preserva o que já foi contado e
 * ainda libera o índice de contagem aberta.
 */
export const stockCounts = pgTable('stock_counts', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  categoryId: uuid('category_id').references(() => categories.id),
  status: stockCountStatusEnum('status').notNull().default('em_andamento'),
  notes: text('notes'),
  cancelReason: text('cancel_reason'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ...auditBy,
}, (table) => ({
  companyStartedAtIdx: index('stock_counts_company_started_at_idx').on(table.companyId, table.startedAt),
  umaAbertaPorEmpresa: uniqueIndex('stock_counts_uma_aberta_por_empresa')
    .on(table.companyId)
    .where(sql`${table.status} in ('em_andamento', 'em_conferencia')`),
}))

/**
 * `previousQuantity` e `unitCost` ficam vazios até o encerramento, quando recebem o saldo e o custo
 * do instante do ajuste. Ler a divergência de uma contagem encerrada pelo estoque atual do produto
 * daria número diferente a cada consulta.
 */
export const stockCountItems = pgTable('stock_count_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  stockCountId: uuid('stock_count_id')
    .notNull()
    .references(() => stockCounts.id),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  countedQuantity: numeric('counted_quantity', { precision: 12, scale: 3 }),
  countedAt: timestamp('counted_at', { withTimezone: true }),
  countedBy: uuid('counted_by'),
  previousQuantity: numeric('previous_quantity', { precision: 12, scale: 3 }),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }),
}, (table) => ({
  countProductUnique: uniqueIndex('stock_count_items_unique').on(table.stockCountId, table.productId),
  productIdx: index('stock_count_items_product_idx').on(table.productId),
}))
