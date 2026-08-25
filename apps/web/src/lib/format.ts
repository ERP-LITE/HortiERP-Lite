export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR')
}

export function formatDateOnly(value: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export function formatCurrency(value: string | number | null | undefined, empty?: string) {
  if (empty !== undefined && (value === null || value === undefined || value === '')) return empty
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatMonthYear(value: string | Date) {
  const date =
    typeof value === 'string'
      ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1)
      : value
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

export type InputMask = 'cnpj' | 'cpf' | 'phone' | 'cep'

/**
 * CNPJ alfanumérico: as 12 primeiras posições aceitam letra ou dígito, os dois dígitos
 * verificadores continuam numéricos. Espelha a normalização da API (companies.schema.ts).
 */
export function normalizeCnpj(value: string) {
  const raw = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  return (raw.slice(0, 12) + raw.slice(12, 14).replace(/\D/g, '')).slice(0, 14)
}

export function formatInputMask(value: string, mask: InputMask) {
  const limits: Record<InputMask, number> = { cnpj: 14, cpf: 11, phone: 11, cep: 8 }
  const digits = value.replace(/\D/g, '').slice(0, limits[mask])

  if (mask === 'cep') {
    return digits.replace(/^(\d{5})(\d)/, '$1-$2')
  }

  if (mask === 'cpf') {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }

  if (mask === 'cnpj') {
    const base = normalizeCnpj(value)
    let masked = base.slice(0, 2)
    if (base.length > 2) masked += `.${base.slice(2, 5)}`
    if (base.length > 5) masked += `.${base.slice(5, 8)}`
    if (base.length > 8) masked += `/${base.slice(8, 12)}`
    if (base.length > 12) masked += `-${base.slice(12, 14)}`
    return masked
  }

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/^(\(\d{2}\) \d{4})(\d)/, '$1-$2')
  }

  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^(\(\d{2}\) \d{5})(\d)/, '$1-$2')
}

export function formatCnpj(value: string | null | undefined) {
  return value ? formatInputMask(value, 'cnpj') : ''
}

export function formatPhone(value: string | null | undefined) {
  return value ? formatInputMask(value, 'phone') : ''
}

export function formatQuantity(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '0'
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

export function formatChartNumber(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  // Arredonda para cima: 10 MB e um byte não pode aparecer como "10,00 MB" numa mensagem de limite
  const megas = Math.ceil((bytes / 1024 / 1024) * 100) / 100
  return `${megas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`
}
