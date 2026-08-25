import { and, count, desc, eq, max, min } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { activityLogs, systemLogs } from '../../db/schema/index.js'
import { getUserProfile } from './auth.service.js'
import { comEscopoDePlataforma } from '../../db/scope.js'

// Nada aqui pode ser dado de outra pessoa: as atividades filtram por `actorId`, e o histórico
// técnico entra como resumo em vez de lista de IPs.
const MAX_ACTIVITY_ROWS = 5000

// Travessia declarada: durante impersonação a conta de quem está logado é de outra empresa.
export async function exportOwnPersonalData(companyId: string, userId: string) {
  return comEscopoDePlataforma(() => montarExportacao(companyId, userId))
}

async function montarExportacao(companyId: string, userId: string) {
  const user = await getUserProfile(companyId, userId)

  const [atividades, [totalAtividades], [acessos]] = await Promise.all([
    db
      .select({
        data: activityLogs.createdAt,
        acao: activityLogs.action,
        tipoDeRegistro: activityLogs.entity,
        registro: activityLogs.entityLabel,
        detalhes: activityLogs.details,
      })
      .from(activityLogs)
      .where(and(eq(activityLogs.companyId, companyId), eq(activityLogs.actorId, userId)))
      .orderBy(desc(activityLogs.createdAt))
      .limit(MAX_ACTIVITY_ROWS),
    db
      .select({ total: count() })
      .from(activityLogs)
      .where(and(eq(activityLogs.companyId, companyId), eq(activityLogs.actorId, userId))),
    db
      .select({
        total: count(),
        primeiro: min(systemLogs.createdAt),
        ultimo: max(systemLogs.createdAt),
      })
      .from(systemLogs)
      .where(and(eq(systemLogs.companyId, companyId), eq(systemLogs.actorId, userId))),
  ])

  return {
    geradoEm: new Date().toISOString(),
    titular: {
      nome: user.name,
      email: user.email,
      perfilDeAcesso: user.role,
      contaAtiva: user.active,
      cadastradoEm: user.createdAt,
      atualizadoEm: user.updatedAt,
    },
    empresa: {
      nome: user.company.name,
      observacao:
        'A empresa é a controladora dos dados. Pedidos de correção ou exclusão devem ser feitos a ela.',
    },
    atividades: {
      total: totalAtividades.total,
      exportadas: atividades.length,
      truncado: totalAtividades.total > atividades.length,
      registros: atividades,
    },
    historicoDeAcesso: {
      total: acessos.total,
      primeiroEm: acessos.primeiro,
      ultimoEm: acessos.ultimo,
      observacao:
        'Registros de data, hora e endereço IP das requisições, guardados por exigência do Marco Civil da Internet (art. 15). O detalhamento é fornecido sob sigilo, mediante pedido.',
    },
  }
}
