import { index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
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
  invoiceNumber: text('invoice_number'),
  invoiceSeries: text('invoice_series'),
  invoiceAccessKey: text('invoice_access_key'),
  invoiceIssuedAt: timestamp('invoice_issued_at', { withTimezone: true }),
  invoiceTotal: numeric('invoice_total', { precision: 12, scale: 2 }),
  ...timestamps,
  ...auditBy,
}, (table) => ({
  companyEntryDateIdx: index('stock_entries_company_entry_date_idx').on(table.companyId, table.entryDate),
}))

export const stockEntryAttachments = pgTable('stock_entry_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  stockEntryId: uuid('stock_entry_id')
    .notNull()
    .references(() => stockEntries.id),
  originalName: text('original_name').notNull(),
  storedName: text('stored_name').notNull().unique(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
}, (table) => ({
  entryIdx: index('stock_entry_attachments_entry_idx').on(table.stockEntryId),
  companyIdx: index('stock_entry_attachments_company_idx').on(table.companyId),
}))

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
}, (table) => ({
  entryIdx: index('stock_entry_items_entry_idx').on(table.stockEntryId),
  productIdx: index('stock_entry_items_product_idx').on(table.productId),
}))
