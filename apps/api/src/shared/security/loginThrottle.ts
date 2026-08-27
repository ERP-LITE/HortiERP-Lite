import { AppError } from '../errors/AppError.js'
import { formatRetryDelay } from '../errors/frameworkMessages.js'

/**
 * Freio de tentativas de login por conta, complementar ao limite por IP do @fastify/rate-limit.
 * O limite por IP sozinho não segura teste de senha distribuído; este segura, porque a chave é o
 * e-mail digitado.
 *
 * É bloqueio temporário e curto, não travamento da conta: travar até um admin destravar deixaria
 * qualquer pessoa derrubar o acesso de um colega só errando a senha dele algumas vezes.
 *
 * Vive em memória de propósito. Gravar cada falha no banco custa uma escrita por tentativa (que é
 * justamente o que o atacante controla) e transformaria a tabela de usuários em registro de
 * tentativa de invasão. O custo é que reiniciar a API zera a contagem, aceitável porque quem chama
 * não decide quando a API reinicia.
 */

const JANELA_MS = 15 * 60 * 1000
const MAX_CONTAS_VIGIADAS = 10_000

/** Do mais severo para o menos: vale a primeira faixa que o número de falhas alcança. */
const DEGRAUS = [
  { falhas: 15, bloqueioMs: 15 * 60 * 1000 },
  { falhas: 10, bloqueioMs: 5 * 60 * 1000 },
  { falhas: 5, bloqueioMs: 60 * 1000 },
] as const

interface Tentativas {
  falhas: number
  ultimaFalhaEm: number
  bloqueadoAte: number
}

export function criarLoginThrottle(agora: () => number = Date.now) {
  const porConta = new Map<string, Tentativas>()

  function limpar(instante: number) {
    for (const [conta, tentativas] of porConta) {
      if (instante - tentativas.ultimaFalhaEm > JANELA_MS && instante > tentativas.bloqueadoAte) {
        porConta.delete(conta)
      }
    }
  }

  function assertLoginAllowed(conta: string) {
    const instante = agora()
    const tentativas = porConta.get(conta)
    if (!tentativas || instante >= tentativas.bloqueadoAte) return

    // Mesma frase do limite por IP: dizer "esta conta está bloqueada" contaria a quem tenta que o
    // e-mail existe.
    throw new AppError(
      `Muitas tentativas em pouco tempo. Tente novamente em ${formatRetryDelay(tentativas.bloqueadoAte - instante)}.`,
      429,
      'RATE_LIMITED',
    )
  }

  function registerLoginFailure(conta: string) {
    const instante = agora()
    limpar(instante)

    const anterior = porConta.get(conta)
    const dentroDaJanela = anterior && instante - anterior.ultimaFalhaEm <= JANELA_MS
    const falhas = (dentroDaJanela ? anterior.falhas : 0) + 1

    const degrau = DEGRAUS.find((item) => falhas >= item.falhas)
    const bloqueadoAte = degrau ? instante + degrau.bloqueioMs : 0

    // Conta nova só entra no mapa se houver espaço: sem isso, uma enxurrada de e-mails diferentes
    // com uma falha cada encheria a memória sem nunca bloquear ninguém.
    if (!anterior && !degrau && porConta.size >= MAX_CONTAS_VIGIADAS) return

    porConta.set(conta, { falhas, ultimaFalhaEm: instante, bloqueadoAte })
  }

  function clearLoginFailures(conta: string) {
    porConta.delete(conta)
  }

  return { assertLoginAllowed, registerLoginFailure, clearLoginFailures }
}

export const loginThrottle = criarLoginThrottle()
