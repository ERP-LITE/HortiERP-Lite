import { buildApp } from './app.js'
import { pool } from './db/client.js'
import { env } from './shared/config/env.js'

const app = buildApp()
let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  app.log.info({ signal }, 'Encerrando API')

  try {
    await app.close()
    await pool.end()
    process.exit(0)
  } catch (error) {
    app.log.error(error, 'Falha ao encerrar API corretamente')
    process.exit(1)
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`HortiERP API rodando em ${address}`)
  })
  .catch((error) => {
    app.log.error(error)
    void pool.end().finally(() => process.exit(1))
  })
