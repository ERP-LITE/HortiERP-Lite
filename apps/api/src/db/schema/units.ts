import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
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
})
