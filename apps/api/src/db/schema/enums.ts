import { pgEnum } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'gerente', 'operador', 'super_admin'])

export const movementTypeEnum = pgEnum('movement_type', ['entrada', 'perda', 'ajuste'])

/**
 * Etapas da contagem de estoque. `em_conferencia` existe para separar contar de aplicar: é só ao
 * entrar nela que o sistema revela o saldo que ele achava que tinha. Ver docs/fluxos-de-negocio.md.
 */
export const stockCountStatusEnum = pgEnum('stock_count_status', [
  'em_andamento',
  'em_conferencia',
  'concluida',
  'cancelada',
])

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
