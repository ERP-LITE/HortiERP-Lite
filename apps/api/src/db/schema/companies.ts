import { sql } from 'drizzle-orm'
import { boolean, date, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { subscriptionStatusEnum } from './enums.js'
import { plans } from './plans.js'
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
    planId: uuid('plan_id').references(() => plans.id, { onDelete: 'restrict' }),
    subscriptionStatus: subscriptionStatusEnum('subscription_status').notNull().default('ativa'),
    // `date` e não timestamp: o contador é de dias corridos, e com hora a última diária duraria
    // um pedaço de dia diferente para cada empresa, conforme a hora em que ela se cadastrou.
    trialEndsOn: date('trial_ends_on'),
    // Quando a pessoa marcou o aceite do aviso de privacidade no cadastro público. Nulo nas empresas
    // cadastradas pela plataforma, onde o aceite acontece na assinatura do contrato, fora do sistema.
    privacyAcceptedAt: timestamp('privacy_accepted_at', { withTimezone: true }),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('companies_document_active_unique')
      .on(table.document)
      .where(sql`${table.deletedAt} is null and ${table.document} is not null`),
    uniqueIndex('companies_name_active_unique')
      .on(sql`lower(trim(${table.name}))`)
      .where(sql`${table.deletedAt} is null`),
  ],
)
