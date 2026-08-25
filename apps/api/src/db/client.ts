import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '../shared/config/env.js'
import * as schema from './schema/index.js'

// Papel de aplicação, sem superusuário: é o que faz o RLS valer. O papel dono só aparece em
// migrate.ts. Ver docs/decisoes-arquiteturais.md.
export const pool = new Pool({
  connectionString: env.APP_DATABASE_URL,
})

export const db = drizzle(pool, { schema })
