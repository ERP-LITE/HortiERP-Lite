import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { companies } from './companies.js'
import { users } from './users.js'

/**
 * O que fica guardado é o SHA-256 do token, não o token. Quem ler esta tabela (um dump, um backup,
 * um olhar no banco) não consegue redefinir a senha de ninguém. Não é bcrypt porque a consulta é
 * uma busca por igualdade e bcrypt não indexa; o token tem 256 bits de aleatoriedade, então não há
 * dicionário que ataque o hash.
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('password_reset_tokens_hash_unique').on(table.tokenHash),
    index('password_reset_tokens_user_idx').on(table.userId, table.createdAt),
    index('password_reset_tokens_expires_idx').on(table.expiresAt),
  ],
)
