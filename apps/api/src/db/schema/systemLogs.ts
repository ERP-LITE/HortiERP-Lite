import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies.js'

export const systemLogs = pgTable(
  'system_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').references(() => companies.id),
    actorId: uuid('actor_id'),
    actorRole: text('actor_role'),
    method: text('method').notNull(),
    path: text('path').notNull(),
    statusCode: integer('status_code').notNull(),
    durationMs: integer('duration_ms').notNull(),
    level: text('level').notNull().default('info'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedAtIdx: index('system_logs_company_created_at_idx').on(table.companyId, table.createdAt),
    levelCreatedAtIdx: index('system_logs_level_created_at_idx').on(table.level, table.createdAt),
    createdAtIdx: index('system_logs_created_at_idx').on(table.createdAt),
  }),
)
