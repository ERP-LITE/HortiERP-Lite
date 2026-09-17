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

/**
 * O Drizzle soterra a mensagem do banco num despejo do SQL inteiro. Migração que aborta de propósito
 * escreve uma instrução para quem opera, e ela precisa sair na primeira linha.
 */
function mensagemDoBanco(error: unknown): string | undefined {
  const causa = typeof error === 'object' && error !== null ? (error as { cause?: unknown }).cause : undefined
  const mensagem = typeof causa === 'object' && causa !== null ? (causa as { message?: unknown }).message : undefined
  return typeof mensagem === 'string' ? mensagem : undefined
}

run().catch(async (error) => {
  const doBanco = mensagemDoBanco(error)
  if (doBanco) {
    console.error(`Falha ao aplicar migrations: ${doBanco}`)
  } else {
    console.error('Falha ao aplicar migrations:', error)
  }

  await ownerPool.end().catch(() => {})
  process.exit(1)
})
