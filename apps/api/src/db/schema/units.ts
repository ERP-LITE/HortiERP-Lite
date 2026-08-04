import { sql } from 'drizzle-orm'
import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { auditBy, timestamps } from './columns.js'
import { companies } from './companies.js'

export const units = pgTable('units', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  name: text('name').notNull(),
  abbreviation: text('abbreviation').notNull(),
  ...timestamps,
  ...auditBy,
}, (table) => ({
  companyNameUnique: uniqueIndex('units_company_name_active_unique')
    .on(table.companyId, sql`lower(${table.name})`)
    .where(sql`${table.deletedAt} is null`),
  companyAbbreviationUnique: uniqueIndex('units_company_abbreviation_active_unique')
    .on(table.companyId, sql`lower(${table.abbreviation})`)
    .where(sql`${table.deletedAt} is null`),
}))
