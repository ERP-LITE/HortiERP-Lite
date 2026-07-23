import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { auditBy, timestamps } from './columns.js'
import { companies } from './companies.js'

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  name: text('name').notNull(),
  description: text('description'),
  ...timestamps,
  ...auditBy,
})
