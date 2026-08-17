import { z } from 'zod'
import { businessDate, endOfBusinessDay, startOfBusinessDay } from '../utils/date.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function businessDayBoundary(edge: 'start' | 'end') {
  return z
    .string()
    .trim()
    .min(1)
    .transform((value, context) => {
      if (ISO_DATE.test(value)) {
        const boundary = edge === 'start' ? startOfBusinessDay(value) : endOfBusinessDay(value)
        // `Date.UTC` normaliza silenciosamente (2026-13-45 viraria fevereiro de 2027);
        // comparar de volta rejeita a data impossível em vez de aceitar outro dia.
        if (businessDate(boundary) !== value) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida' })
          return z.NEVER
        }
        return boundary
      }

      const instant = new Date(value)
      if (Number.isNaN(instant.getTime())) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida' })
        return z.NEVER
      }
      return instant
    })
    .optional()
}

export const periodStartParam = businessDayBoundary('start')

export const periodEndParam = businessDayBoundary('end')

export const periodQueryFields = {
  from: periodStartParam,
  to: periodEndParam,
}
