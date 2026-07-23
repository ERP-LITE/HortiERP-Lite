import { z } from 'zod'

export const lossReasons = ['vencido', 'avariado', 'roubo_furto', 'erro_operacional', 'outro'] as const

export const createLossSchema = z.object({
  productId: z.string().uuid('Produto inválido'),
  quantity: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  reason: z.enum(lossReasons),
  notes: z.string().optional(),
  lossDate: z.coerce.date().optional(),
})

export type CreateLossInput = z.infer<typeof createLossSchema>
