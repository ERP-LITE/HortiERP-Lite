import { z } from 'zod'

export const createUnitSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  abbreviation: z.string().min(1, 'Abreviação é obrigatória').max(10),
})

export const updateUnitSchema = createUnitSchema.partial()

export type CreateUnitInput = z.infer<typeof createUnitSchema>
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>
