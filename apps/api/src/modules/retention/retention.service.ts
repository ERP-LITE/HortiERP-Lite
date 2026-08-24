import { and, count, eq, isNotNull, lt, notLike } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { activityLogs, systemLogs, users } from '../../db/schema/index.js'

// Domínio reservado pela RFC 2606: nunca poderá ser registrado por ninguém.
const ANONYMIZED_EMAIL_DOMAIN = 'anonimizado.invalid'

export const ANONYMIZED_USER_NAME = 'Usuário removido'

// Sem formato bcrypt de propósito: `bcrypt.compare` nunca casa, mesmo se a conta for reativada.
const ANONYMIZED_PASSWORD_HASH = 'anonimizado'

export interface RetentionSummary {
  technicalLogs: number
  activityLogs: number
  anonymizedUsers: number
}

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

export async function anonymizeDeletedUsers(cutoff: Date, dryRun = false) {
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        lt(users.deletedAt, cutoff),
        // Já anonimizado não entra de novo na conta.
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

      // O nome também mora em `entityLabel`; sem esta limpeza ele segue legível no histórico.
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
