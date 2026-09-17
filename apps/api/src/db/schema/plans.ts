import { boolean, integer, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { timestamps } from './columns.js'

/**
 * Tabela da plataforma, sem empresa: é a lista de preços que aparece antes do cadastro. Fica no
 * banco, e não em constante no código, para mudar de preço não virar publicação de versão.
 */
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  monthlyAmount: numeric('monthly_amount', { precision: 12, scale: 2 }).notNull(),
  trialDays: integer('trial_days').notNull(),
  stripePriceId: text('stripe_price_id'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
})
