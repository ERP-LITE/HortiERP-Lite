import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { auditBy, timestamps } from './columns.js'
import { companies } from './companies.js'
import { userRoleEnum } from './enums.js'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('operador'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
  ...auditBy,
})
