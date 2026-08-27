import { and, count, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { comEscopoDePlataforma } from '../../db/scope.js'
import { systemLogs } from '../../db/schema/index.js'

export interface ErrorGroup {
  method: string
  path: string
  statusCode: number
  total: number
  /** Uma das mensagens do grupo, para o alerta dizer o que quebrou sem abrir a tela de logs. */
  mensagemExemplo: string | null
}

export interface ErrorSummary {
  total: number
  desde: Date
  grupos: ErrorGroup[]
}

/**
 * Agrupa os erros de servidor (`level = 'error'`, ou seja, status 5xx) registrados na janela pedida.
 *
 * Sem filtro de empresa de propósito: é sinal operacional do sistema inteiro, e filtrar por empresa
 * esconderia o erro que está acontecendo em outra. O escopo de plataforma é aberto aqui, e não no
 * chamador, porque sem ele as políticas de RLS devolvem zero linha e o alerta silenciaria em vez de
 * falhar, que é o pior dos dois defeitos.
 *
 * O índice `system_logs_level_created_at_idx` cobre exatamente este par de condições.
 */
export async function summarizeRecentErrors(windowSeconds: number): Promise<ErrorSummary> {
  const desde = new Date(Date.now() - windowSeconds * 1000)

  return comEscopoDePlataforma(async () => {
    const grupos = await db
      .select({
        method: systemLogs.method,
        path: systemLogs.path,
        statusCode: systemLogs.statusCode,
        total: count(),
        mensagemExemplo: sql<string | null>`max(${systemLogs.errorMessage})`,
      })
      .from(systemLogs)
      .where(and(eq(systemLogs.level, 'error'), gte(systemLogs.createdAt, desde)))
      .groupBy(systemLogs.method, systemLogs.path, systemLogs.statusCode)
      .orderBy(desc(count()))

    return {
      total: grupos.reduce((soma, grupo) => soma + grupo.total, 0),
      desde,
      grupos,
    }
  })
}

/** Corpo enviado ao monitor: é o que aparece no e-mail do alerta. */
export function describeErrorSummary(resumo: ErrorSummary) {
  if (resumo.total === 0) return 'Nenhum erro de servidor na janela.'

  const linhas = resumo.grupos.map(
    (grupo) =>
      `${grupo.total}x ${grupo.method} ${grupo.path} -> ${grupo.statusCode}` +
      (grupo.mensagemExemplo ? `: ${grupo.mensagemExemplo}` : ''),
  )

  return [`${resumo.total} erro(s) de servidor desde ${resumo.desde.toISOString()}:`, ...linhas].join('\n')
}
