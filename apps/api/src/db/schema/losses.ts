import { index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { auditBy, timestamps } from './columns.js'
import { companies } from './companies.js'
import { products } from './products.js'
import { lossReasonEnum } from './enums.js'

export const losses = pgTable('losses', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }),
  reason: lossReasonEnum('reason').notNull(),
  notes: text('notes'),
  lossDate: timestamp('loss_date', { withTimezone: true }).notNull().defaultNow(),
  // Cancelamento (estorno) da perda. Colunas próprias em vez de reaproveitar o
  // `deletedAt`: uma perda cancelada não é um registro excluído — ela continua
  // visível e auditável, e o histórico precisa guardar quem cancelou e por quê.
  // Enquanto `cancelledAt` for nulo a perda conta normalmente nos relatórios.
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledBy: uuid('cancelled_by'),
  cancelReason: text('cancel_reason'),
  ...timestamps,
  ...auditBy,
}, (table) => ({
  companyLossDateIdx: index('losses_company_loss_date_idx').on(table.companyId, table.lossDate),
  companyProductIdx: index('losses_company_product_idx').on(table.companyId, table.productId),
}))
