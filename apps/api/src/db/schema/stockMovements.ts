import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies.js'
import { products } from './products.js'
import { movementTypeEnum } from './enums.js'

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  type: movementTypeEnum('type').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 12, scale: 3 }).notNull(),
  referenceType: text('reference_type').notNull(),
  referenceId: uuid('reference_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
})
