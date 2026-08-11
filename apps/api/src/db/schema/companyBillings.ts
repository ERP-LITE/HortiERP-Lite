import { date, index, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies.js'
import { users } from './users.js'
import { timestamps } from './columns.js'

export const companyBillings = pgTable(
  'company_billings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    referenceMonth: date('reference_month').notNull(),
    dueDate: date('due_date').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }),
    paidAt: date('paid_at'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('company_billings_company_reference_unique').on(table.companyId, table.referenceMonth),
    index('company_billings_reference_due_idx').on(table.referenceMonth, table.dueDate),
  ],
)
