import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { auditBy, timestamps } from './columns.js'
import { companies } from './companies.js'
import { products } from './products.js'

export const stockEntries = pgTable('stock_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  supplierName: text('supplier_name'),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
  ...timestamps,
  ...auditBy,
})

export const stockEntryItems = pgTable('stock_entry_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  stockEntryId: uuid('stock_entry_id')
    .notNull()
    .references(() => stockEntries.id),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
