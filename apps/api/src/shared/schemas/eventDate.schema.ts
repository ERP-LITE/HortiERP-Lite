import { z } from 'zod'
import { addDaysToIsoDate, businessDate, startOfBusinessDay, todayIsoDate } from '../utils/date.js'

/** Até quantos dias para trás um lançamento operacional aceita data retroativa. */
export const MAX_BACKDATE_DAYS = 365

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function resolveEventInstant(value: string, context: z.RefinementCtx) {
  const invalid = () => {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida' })
    return z.NEVER
  }

  let instant: Date
  if (ISO_DATE.test(value)) {
    const dayStart = startOfBusinessDay(value)
    if (businessDate(dayStart) !== value) return invalid()
    /*
     * A tela manda só a data civil. Quando é hoje, guardamos o instante real do lançamento,
     * para o histórico de movimentações manter a hora; retroativa guarda o início do dia,
     * porque a hora verdadeira do fato é desconhecida e inventá-la seria pior.
     */
    instant = value === todayIsoDate() ? new Date() : dayStart
  } else {
    instant = new Date(value)
    if (Number.isNaN(instant.getTime())) return invalid()
  }

  const day = businessDate(instant)
  const today = todayIsoDate()

  if (day > today) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A data não pode ser futura' })
    return z.NEVER
  }

  if (day < addDaysToIsoDate(today, -MAX_BACKDATE_DAYS)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `A data não pode ser anterior a ${MAX_BACKDATE_DAYS} dias atrás`,
    })
    return z.NEVER
  }

  return instant
}

/**
 * Data em que o fato aconteceu, informada pelo usuário. Aceita a data civil `AAAA-MM-DD` que as
 * telas mandam e também um instante ISO completo. Sempre resolvida no fuso do negócio.
 */
export const eventDateSchema = z.string().trim().min(1).transform(resolveEventInstant)
