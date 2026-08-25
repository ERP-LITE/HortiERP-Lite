import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { env } from '../shared/config/env.js'
import { ensureAppRole } from './appRole.js'

const ownerPool = new Pool({ connectionString: env.DATABASE_URL })

async function run() {
  console.log('Aplicando migrations...')
  await migrate(drizzle(ownerPool), { migrationsFolder: './src/db/migrations' })
  console.log('Migrations aplicadas com sucesso.')

  // Depois das migrations: os GRANT precisam alcançar as tabelas que acabaram de nascer.
  await ensureAppRole(ownerPool)

  await ownerPool.end()
}

run().catch(async (error) => {
  console.error('Falha ao aplicar migrations:', error)
  await ownerPool.end().catch(() => {})
  process.exit(1)
})
