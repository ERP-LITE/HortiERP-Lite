/** Fuso usado pelas regras de negócio que dependem do "dia de hoje". */
export const APP_TIME_ZONE = 'America/Sao_Paulo'

/**
 * Data de hoje no fuso do negócio, no formato `AAAA-MM-DD` das colunas `date`.
 *
 * Os containers rodam em UTC, então `new Date().toISOString()` já devolve o dia
 * seguinte a partir das 21h de Brasília — uma cobrança que vence hoje apareceria
 * como atrasada no fim da tarde. O front monta os períodos com a data local do
 * usuário (`lib/period.ts`), e este helper mantém o servidor no mesmo dia.
 */
export function todayIsoDate(timeZone = APP_TIME_ZONE) {
  // 'en-CA' é o locale que formata como AAAA-MM-DD sem precisar remontar a string.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}
