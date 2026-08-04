import { sql } from 'drizzle-orm'
import { boolean, index, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { auditBy, timestamps } from './columns.js'
import { companies } from './companies.js'
import { categories } from './categories.js'
import { units } from './units.js'

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  unitId: uuid('unit_id')
    .notNull()
    .references(() => units.id),
  name: text('name').notNull(),
  sku: text('sku'),
  barcode: text('barcode'),
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }),
  salePrice: numeric('sale_price', { precision: 12, scale: 2 }),
  minStock: numeric('min_stock', { precision: 12, scale: 3 }).notNull().default('0'),
  currentStock: numeric('current_stock', { precision: 12, scale: 3 }).notNull().default('0'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
  ...auditBy,
}, (table) => ({
  companyNameUnique: uniqueIndex('products_company_name_active_unique')
    .on(table.companyId, sql`lower(${table.name})`)
    .where(sql`${table.deletedAt} is null`),
  companySkuUnique: uniqueIndex('products_company_sku_active_unique')
    .on(table.companyId, sql`lower(${table.sku})`)
    .where(sql`${table.deletedAt} is null and ${table.sku} is not null`),
  companyActiveIdx: index('products_company_active_idx').on(table.companyId, table.active),
}))
