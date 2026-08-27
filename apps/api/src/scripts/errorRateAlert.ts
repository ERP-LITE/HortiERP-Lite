import { pool } from '../db/client.js'
import { comEscopoDePlataforma } from '../db/scope.js'
import { env } from '../shared/config/env.js'
import { describeErrorSummary, summarizeRecentErrors } from '../modules/logs/error-alert.service.js'

/** Folga sobre o intervalo: sem ela, um erro no exato limite entre duas rodadas não seria contado. */
const FOLGA_SEGUNDOS = 60

// Mesma semântica do backup e da retenção: o monitor externo recebe sinal de vida quando está tudo
// bem e `/fail` quando não está. Quem decide se manda e-mail é o healthchecks.io, que só avisa na
// mudança de estado — então erro que persiste rende um e-mail, não um por rodada.
async function sinalDeVida(sufixo = '', corpo?: string) {
  const base = env.ERROR_ALERT_HEARTBEAT_URL
  if (!base) return

  const url = sufixo ? `${base.replace(/\/$/, '')}${sufixo}` : base
  try {
    await fetch(url, {
      method: corpo ? 'POST' : 'GET',
      body: corpo,
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    console.error(`Não foi possível avisar o monitor em ${url}:`, error)
  }
}

async function run() {
  if (!env.ERROR_ALERT_HEARTBEAT_URL) {
    console.log('ERROR_ALERT_HEARTBEAT_URL não definida: nada a vigiar. Veja docs/deploy-producao.md.')
    return
  }

  const janela = env.ERROR_ALERT_INTERVAL_SECONDS + FOLGA_SEGUNDOS
  const resumo = await summarizeRecentErrors(janela)
  const descricao = describeErrorSummary(resumo)

  console.log(descricao)

  if (resumo.total >= env.ERROR_ALERT_THRESHOLD) {
    await sinalDeVida('/fail', descricao)
    return
  }

  await sinalDeVida()
}

comEscopoDePlataforma(run)
  .catch(async (error) => {
    console.error('Falha ao verificar os erros recentes:', error)
    // Banco fora do ar também é notícia: sem este `/fail`, a falha só apareceria quando o monitor
    // esgotasse a carência por falta de sinal.
    await sinalDeVida('/fail', `Não foi possível consultar system_logs: ${String(error)}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => {})
  })
