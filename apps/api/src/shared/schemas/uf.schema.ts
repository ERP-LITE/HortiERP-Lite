import { z } from 'zod'

export const ufs = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const

export type Uf = (typeof ufs)[number]

export const ufSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(ufs, { errorMap: () => ({ message: 'Informe uma UF válida' }) }))
