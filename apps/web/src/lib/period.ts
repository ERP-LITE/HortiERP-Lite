export type PeriodPreset = 'todos' | 'hoje' | '7dias' | '30dias' | 'mes' | 'mesPassado' | 'personalizado'

export interface PeriodValue {
  preset: PeriodPreset
  from: string
  to: string
}

function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function rangeForPreset(preset: PeriodPreset): { from: string; to: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'hoje':
      return { from: toISODate(today), to: toISODate(today) }
    case '7dias':
      return { from: toISODate(addDays(today, -6)), to: toISODate(today) }
    case '30dias':
      return { from: toISODate(addDays(today, -29)), to: toISODate(today) }
    case 'mes': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: toISODate(start), to: toISODate(today) }
    }
    case 'mesPassado': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: toISODate(start), to: toISODate(end) }
    }
    default:
      return { from: '', to: '' }
  }
}
