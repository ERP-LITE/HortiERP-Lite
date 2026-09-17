import { z } from 'zod'

/**
 * Margem alvo em percentual sobre o preço de venda. O teto de 99,99 não é estético: margem de 100%
 * sobre venda zeraria o divisor do preço sugerido, e acima disso não existe. Bate com o CHECK da
 * migração `0014` e com `numeric(5, 2)`.
 */
export const targetMarginField = z.preprocess(
  (value) => (value === '' ? null : value),
  z.coerce
    .number()
    .min(0, 'A margem não pode ser negativa')
    .max(99.99, 'A margem precisa ser menor que 100%')
    .nullable()
    .optional(),
)
