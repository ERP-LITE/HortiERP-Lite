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

export async function recordActivitySafe(input: ActivityInput) {
  try {
    await recordActivity(input)
  } catch {
  }
}

export async function recordActivitiesSafe(inputs: ActivityInput[], executor: Executor = db) {
  if (inputs.length === 0) return

  try {
    await executor.insert(activityLogs).values(
      inputs.map((input) => ({
        companyId: input.companyId,
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel,
        details: input.details,
      })),
    )
  } catch {
  }
}
