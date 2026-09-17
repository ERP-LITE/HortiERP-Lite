import { pgEnum } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'gerente', 'operador', 'super_admin'])

export const movementTypeEnum = pgEnum('movement_type', ['entrada', 'perda', 'ajuste'])

export const lossReasonEnum = pgEnum('loss_reason', [
  'vencido',
  'avariado',
  'roubo_furto',
  'erro_operacional',
  'outro',
])

/**
 * Situação da assinatura da empresa-cliente. Em português como o resto dos enums do schema, e não
 * nos nomes que a Stripe usa: o valor aparece em tela, e a tradução na borda evitaria que um estado
 * novo criado lá dentro entrasse no banco sem ninguém decidir o que ele significa aqui.
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'teste',
  'ativa',
  'atrasada',
  'cancelada',
])
