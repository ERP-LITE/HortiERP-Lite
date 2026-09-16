import { env } from '../config/env.js'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000

export interface Mensagem {
  to: string
  subject: string
  html: string
  text: string
}

export class MailError extends Error {}

/**
 * Envio pela API da Resend por `fetch`, sem SDK. Mesma escolha do `cep.service.ts`: a chamada é um
 * POST com JSON, e uma dependência a mais custaria atualização e auditoria para não poupar nada.
 *
 * Sem `RESEND_API_KEY` (só fora de produção, onde o `env.ts` recusa subir sem ela) a mensagem vai
 * para o log em vez do correio. É o que permite testar o fluxo inteiro na máquina de quem
 * desenvolve, incluindo o link, sem conta na Resend e sem mandar e-mail para ninguém de verdade.
 */
export async function enviarEmail(mensagem: Mensagem, log?: { info: (obj: object, msg: string) => void }) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    log?.info({ para: mensagem.to, assunto: mensagem.subject, texto: mensagem.text }, 'E-mail não enviado (sem RESEND_API_KEY): conteúdo no log')
    return
  }

  let resposta: Response
  try {
    resposta = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [mensagem.to],
        subject: mensagem.subject,
        html: mensagem.html,
        text: mensagem.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (erro) {
    throw new MailError(`Falha de rede ao falar com a Resend: ${(erro as Error).message}`)
  }

  if (!resposta.ok) {
    // O corpo do erro da Resend traz o motivo (domínio não verificado, chave sem permissão). Ele
    // vai para o log do servidor, nunca para a resposta de quem chamou.
    const corpo = await resposta.text().catch(() => '')
    throw new MailError(`Resend respondeu ${resposta.status}: ${corpo.slice(0, 500)}`)
  }
}
