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
  reason: lossReasonEnum('reason').notNull(),
  notes: text('notes'),
  lossDate: timestamp('loss_date', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
  ...auditBy,
}, (table) => ({
  companyLossDateIdx: index('losses_company_loss_date_idx').on(table.companyId, table.lossDate),
  companyProductIdx: index('losses_company_product_idx').on(table.companyId, table.productId),
}))
