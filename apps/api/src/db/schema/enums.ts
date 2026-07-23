import { pgEnum } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'gerente', 'operador'])

export const movementTypeEnum = pgEnum('movement_type', ['entrada', 'perda', 'ajuste'])

export const lossReasonEnum = pgEnum('loss_reason', [
  'vencido',
  'avariado',
  'roubo_furto',
  'erro_operacional',
  'outro',
])
