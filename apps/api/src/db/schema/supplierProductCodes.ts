import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { auditBy } from './columns.js'
import { companies } from './companies.js'
import { products } from './products.js'

/**
 * Sem exclusão lógica de propósito: vínculo errado é corrigido por cima na entrada seguinte, e um
 * "de para" apagado que continuasse ocupando o índice único impediria o vínculo novo.
 */
export const supplierProductCodes = pgTable('supplier_product_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  supplierDocument: text('supplier_document').notNull(),
  supplierCode: text('supplier_code').notNull(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ...auditBy,
}, (table) => ({
  companySupplierCodeUnique: uniqueIndex('supplier_product_codes_unique')
    .on(table.companyId, table.supplierDocument, table.supplierCode),
  productIdx: index('supplier_product_codes_product_idx').on(table.productId),
}))
