import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies.js'

/**
 * Auditoria de negócio: registra QUAL registro foi criado, alterado ou excluído.
 *
 * Complementa (não substitui) `system_logs`, que continua guardando a requisição HTTP crua
 * para diagnóstico técnico. A diferença prática é o que o administrador enxerga: aqui dá
 * para responder "quem excluiu o produto Tomate", coisa que o log de requisições não sabe,
 * porque só conhece o método e a rota.
 *
 * `entityLabel` guarda o nome do registro no momento da ação de propósito. Se o histórico
 * dependesse de join com a tabela de origem, excluir o produto apagaria a resposta junto —
 * justamente o caso que mais se quer auditar.
 */
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id'),
    entityLabel: text('entity_label').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedAtIdx: index('activity_logs_company_created_at_idx').on(table.companyId, table.createdAt),
    entityIdx: index('activity_logs_entity_idx').on(table.companyId, table.entity, table.createdAt),
  }),
)
