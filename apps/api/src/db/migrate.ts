import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './client.js'

async function run() {
  console.log('Aplicando migrations...')
  await migrate(db, { migrationsFolder: './src/db/migrations' })
  console.log('Migrations aplicadas com sucesso.')
  await pool.end()
}

run().catch((error) => {
  console.error('Falha ao aplicar migrations:', error)
  process.exit(1)
})
