import { sql } from 'drizzle-orm'
import { boolean, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { timestamps } from './columns.js'

export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    legalName: text('legal_name'),
    document: text('document'),
    stateRegistration: text('state_registration'),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    phone: text('phone'),
    postalCode: text('postal_code'),
    street: text('street'),
    addressNumber: text('address_number'),
    complement: text('complement'),
    district: text('district'),
    city: text('city'),
    state: text('state'),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('companies_document_active_unique')
      .on(table.document)
      .where(sql`${table.deletedAt} is null and ${table.document} is not null`),
  ],
)
