import { and, count, eq, isNotNull, lt, notLike } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { activityLogs, systemLogs, users } from '../../db/schema/index.js'

/**
 * Domínio reservado pela RFC 2606: não pode ser registrado por ninguém. Serve para o e-mail
 * anonimizado nunca colidir com o de uma pessoa real nem virar destino de contato por acidente.
 */
const ANONYMIZED_EMAIL_DOMAIN = 'anonimizado.invalid'

export const ANONYMIZED_USER_NAME = 'Usuário removido'

/**
 * Não tem formato de hash bcrypt, então `bcrypt.compare` nunca casa com senha alguma. O login já
 * ignora usuário com `deletedAt`; isto é a segunda tranca, para o caso de alguém reativar a conta
 * direto no banco sem perceber que ela foi anonimizada.
 */
const ANONYMIZED_PASSWORD_HASH = 'anonimizado'

export interface RetentionSummary {
  technicalLogs: number
  activityLogs: number
  anonymizedUsers: number
}

/** Corte de retenção. Dia corrido de 24h basta aqui: não é fronteira de dia de negócio. */
export function daysAgo(days: number, reference = new Date()) {
  return new Date(reference.getTime() - days * 24 * 60 * 60 * 1000)
}

export async function purgeTechnicalLogs(cutoff: Date, dryRun = false) {
  const where = lt(systemLogs.createdAt, cutoff)

  if (dryRun) {
    const [{ total }] = await db.select({ total: count() }).from(systemLogs).where(where)
    return total
  }

  const result = await db.delete(systemLogs).where(where)
  return result.rowCount ?? 0
}

export async function purgeActivityLogs(cutoff: Date, dryRun = false) {
  const where = lt(activityLogs.createdAt, cutoff)

  if (dryRun) {
    const [{ total }] = await db.select({ total: count() }).from(activityLogs).where(where)
    return total
  }

  const result = await db.delete(activityLogs).where(where)
  return result.rowCount ?? 0
}

/**
 * Usuário excluído continua no banco com nome e e-mail: a trilha de auditoria referencia o `id`
 * dele, e apagar a linha inteira quebraria o histórico de quem lançou o quê. Passado o prazo de
 * retenção, o vínculo com a pessoa é cortado — o `id` continua, mas deixa de levar a alguém.
 */
export async function anonymizeDeletedUsers(cutoff: Date, dryRun = false) {
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        lt(users.deletedAt, cutoff),
        // Já anonimizado não entra de novo na conta. O sufixo é marcador confiável porque só este
        // código escreve nesse domínio.
        notLike(users.email, `%@${ANONYMIZED_EMAIL_DOMAIN}`),
      ),
    )

  if (dryRun) return candidates.length

  for (const { id } of candidates) {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          name: ANONYMIZED_USER_NAME,
          email: `removido-${id}@${ANONYMIZED_EMAIL_DOMAIN}`,
          passwordHash: ANONYMIZED_PASSWORD_HASH,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))

      // O log de atividades guarda o nome em `entityLabel`. Sem limpar aqui, anonimizar a conta
      // não resolveria nada: o nome seguiria legível na tela de histórico de atividades.
      await tx
        .update(activityLogs)
        .set({ entityLabel: ANONYMIZED_USER_NAME })
        .where(and(eq(activityLogs.entity, 'usuario'), eq(activityLogs.entityId, id)))
    })
  }

  return candidates.length
}

export async function runRetention(options: {
  technicalLogRetentionDays: number
  auditRetentionDays: number
  dryRun?: boolean
  reference?: Date
}): Promise<RetentionSummary> {
  const { technicalLogRetentionDays, auditRetentionDays, dryRun = false, reference } = options
  const technicalCutoff = daysAgo(technicalLogRetentionDays, reference)
  const auditCutoff = daysAgo(auditRetentionDays, reference)

  return {
    technicalLogs: await purgeTechnicalLogs(technicalCutoff, dryRun),
    activityLogs: await purgeActivityLogs(auditCutoff, dryRun),
    anonymizedUsers: await anonymizeDeletedUsers(auditCutoff, dryRun),
  }
}
