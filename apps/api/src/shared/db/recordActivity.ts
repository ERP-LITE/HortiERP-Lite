import { db } from '../../db/client.js'
import { activityLogs } from '../../db/schema/index.js'

export type ActivityAction = 'criou' | 'alterou' | 'excluiu' | 'importou' | 'ajustou' | 'cancelou'

export type ActivityEntity =
  | 'produto'
  | 'categoria'
  | 'unidade'
  | 'usuario'
  | 'entrada'
  | 'perda'
  | 'estoque'

export interface ActivityInput {
  companyId: string
  actorId: string
  action: ActivityAction
  entity: ActivityEntity
  entityId?: string | null
  entityLabel: string
  details?: Record<string, unknown>
}

type Executor = Pick<typeof db, 'insert'>

/**
 * Grava uma linha de auditoria. Recebe `executor` para poder participar da mesma transação
 * da operação auditada: numa entrada de mercadoria que falha no meio, o histórico não pode
 * ficar afirmando que a entrada foi criada.
 *
 * Falha de auditoria nunca derruba a operação do usuário quando roda fora de transação —
 * perder uma linha de histórico é ruim, impedir o lançamento de uma perda é pior.
 */
export async function recordActivity(input: ActivityInput, executor: Executor = db) {
  await executor.insert(activityLogs).values({
    companyId: input.companyId,
    actorId: input.actorId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    entityLabel: input.entityLabel,
    details: input.details,
  })
}

/** Versão que engole o erro, para chamadas fora de transação. */
export async function recordActivitySafe(input: ActivityInput) {
  try {
    await recordActivity(input)
  } catch {
    // O histórico é secundário em relação à operação que o usuário pediu
  }
}
