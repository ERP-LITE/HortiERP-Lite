/** Fuso usado pelas regras de negócio que dependem do "dia de hoje". */
export const APP_TIME_ZONE = 'America/Sao_Paulo'

/** Data civil (`AAAA-MM-DD`) de um instante, lida no fuso do negócio. */
export function businessDate(instant: Date, timeZone = APP_TIME_ZONE) {
  // 'en-CA' é o locale que formata como AAAA-MM-DD sem precisar remontar a string.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant)
}

/**
 * Data de hoje no fuso do negócio, no formato `AAAA-MM-DD` das colunas `date`.
 *
 * Os containers rodam em UTC, então `new Date().toISOString()` já devolve o dia
 * seguinte a partir das 21h de Brasília — uma cobrança que vence hoje apareceria
 * como atrasada no fim da tarde. O front monta os períodos com a data local do
 * usuário (`lib/period.ts`), e este helper mantém o servidor no mesmo dia.
 */
export function todayIsoDate(timeZone = APP_TIME_ZONE) {
  return businessDate(new Date(), timeZone)
}

/**
 * Quanto o relógio do fuso está adiantado em relação ao UTC no instante dado,
 * em milissegundos. Sai de `Intl` em vez de um valor fixo de -3h para que fusos
 * com horário de verão continuem certos (e para não travar a regra num offset
 * que o Brasil já mudou no passado).
 */
function timeZoneOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const field = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  // `hour` volta como 24 (e não 0) na meia-noite em parte dos ambientes com hour12: false.
  const wallClockAsUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour') % 24,
    field('minute'),
    field('second'),
  )

  // As partes formatadas não têm milissegundos; compara contra o instante truncado no segundo.
  return wallClockAsUtc - (instant.getTime() - instant.getMilliseconds())
}

/** Instante UTC correspondente a um horário de parede (`AAAA-MM-DD` + hora) no fuso do negócio. */
function zonedWallClockToInstant(
  isoDate: string,
  time: { hours: number; minutes: number; seconds: number; ms: number },
  timeZone: string,
) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const wallClockAsUtc = Date.UTC(year, month - 1, day, time.hours, time.minutes, time.seconds, time.ms)

  // Duas passadas: a primeira estima o deslocamento pelo próprio horário de parede,
  // a segunda confirma já a partir do instante corrigido — necessário porque o
  // deslocamento pode mudar dentro do dia em fusos com horário de verão.
  const firstGuess = wallClockAsUtc - timeZoneOffsetMs(new Date(wallClockAsUtc), timeZone)
  return new Date(wallClockAsUtc - timeZoneOffsetMs(new Date(firstGuess), timeZone))
}

/** Primeiro instante (00:00:00.000) de uma data civil no fuso do negócio. */
export function startOfBusinessDay(isoDate: string, timeZone = APP_TIME_ZONE) {
  return zonedWallClockToInstant(isoDate, { hours: 0, minutes: 0, seconds: 0, ms: 0 }, timeZone)
}

/** Último instante (23:59:59.999) de uma data civil no fuso do negócio. */
export function endOfBusinessDay(isoDate: string, timeZone = APP_TIME_ZONE) {
  return zonedWallClockToInstant(isoDate, { hours: 23, minutes: 59, seconds: 59, ms: 999 }, timeZone)
}

/**
 * Aritmética de calendário sobre a string `AAAA-MM-DD`, sem passar por fuso
 * nenhum: somar 24h a um instante erraria justamente no dia em que o
 * deslocamento do fuso muda.
 */
export function addDaysToIsoDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day))
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

/** Quantos dias civis separam duas datas `AAAA-MM-DD` (negativo se `to` vier antes). */
export function daysBetweenIsoDates(from: string, to: string) {
  const toUtc = (isoDate: string) => {
    const [year, month, day] = isoDate.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((toUtc(to) - toUtc(from)) / (24 * 60 * 60 * 1000))
}
