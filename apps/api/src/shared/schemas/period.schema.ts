import { z } from 'zod'
import { businessDate, endOfBusinessDay, startOfBusinessDay } from '../utils/date.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Bordas do filtro de período das listagens.
 *
 * O front manda a data civil escolhida pelo usuário, sem hora (`lib/period.ts`).
 * Ler essa string com `z.coerce.date()` a colocava na meia-noite **UTC**: como os
 * containers rodam em UTC e o negócio é `America/Sao_Paulo`, o `to` cortava o dia
 * final inteiro e o preset "hoje" não devolvia nada — uma perda lançada às 10h da
 * manhã ficava fora do próprio dia. Aqui cada ponta é expandida para a borda
 * correta do dia no fuso do negócio: `from` vira 00:00:00.000 e `to` vira
 * 23:59:59.999.
 *
 * Um `AAAA-MM-DDTHH:MM:SSZ` completo continua aceito e é usado como veio, para não
 * quebrar quem já chama a API passando instante exato.
 */
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

/** `from` de um filtro de período: início do dia no fuso do negócio. */
export const periodStartParam = businessDayBoundary('start')

/** `to` de um filtro de período: fim do dia no fuso do negócio. */
export const periodEndParam = businessDayBoundary('end')

/** Par `from`/`to` para estender um schema de listagem. */
export const periodQueryFields = {
  from: periodStartParam,
  to: periodEndParam,
}
