import { pool } from '../db/client.js'
import { env } from '../shared/config/env.js'
import { daysAgo, runRetention } from '../modules/retention/retention.service.js'

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

async function run() {
  const dryRun = process.argv.includes('--dry-run')
  const prefix = dryRun ? '[dry-run] ' : ''

  const technicalDays = env.TECHNICAL_LOG_RETENTION_DAYS
  const auditDays = env.AUDIT_RETENTION_DAYS

  console.log(
    `${prefix}Log técnico: mantendo ${technicalDays} dias (a partir de ${formatDate(daysAgo(technicalDays))}).`,
  )
  console.log(`${prefix}Auditoria: mantendo ${auditDays} dias (a partir de ${formatDate(daysAgo(auditDays))}).`)

  const summary = await runRetention({
    technicalLogRetentionDays: technicalDays,
    auditRetentionDays: auditDays,
    dryRun,
  })

  const verb = dryRun ? 'seriam removidas' : 'removidas'
  console.log(`${prefix}system_logs: ${summary.technicalLogs} linha(s) ${verb}.`)
  console.log(`${prefix}activity_logs: ${summary.activityLogs} linha(s) ${verb}.`)
  console.log(
    `${prefix}usuários excluídos ${dryRun ? 'a anonimizar' : 'anonimizados'}: ${summary.anonymizedUsers}.`,
  )

  if (dryRun) {
    console.log('Nada foi alterado. Rode sem --dry-run para aplicar.')
  }

  await pool.end()
}

run().catch(async (error) => {
  console.error('Falha ao aplicar a retenção de dados:', error)
  await pool.end().catch(() => {})
  process.exit(1)
})
