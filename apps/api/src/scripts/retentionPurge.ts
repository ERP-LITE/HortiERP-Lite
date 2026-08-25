import { pool } from '../db/client.js'
import { env } from '../shared/config/env.js'
import { daysAgo, runRetention } from '../modules/retention/retention.service.js'
import { comEscopoDePlataforma } from '../db/scope.js'

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

// Mesma semântica do backup: avisa o monitor externo ao terminar bem, e chama `/fail` ao falhar —
// assim a falha aparece na hora, sem esperar a janela de tolerância do monitor.
async function sinalDeVida(sufixo = '') {
  const base = env.RETENTION_HEARTBEAT_URL
  if (!base) return

  const url = sufixo ? `${base.replace(/\/$/, '')}${sufixo}` : base
  try {
    await fetch(url, { signal: AbortSignal.timeout(10_000) })
  } catch (error) {
    console.error(`Não foi possível avisar o monitor em ${url}:`, error)
  }
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
    return
  }

  await sinalDeVida()
}

// Escopo de plataforma: o corte da retenção é por data, não por empresa.
comEscopoDePlataforma(run)
  .catch(async (error) => {
    console.error('Falha ao aplicar a retenção de dados:', error)
    await sinalDeVida('/fail')
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => {})
  })
