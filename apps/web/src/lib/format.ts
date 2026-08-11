export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR')
}

// Recebe uma data "YYYY-MM-DD" (sem horário) e formata sem passar por `new Date()`,
// evitando que o fuso do navegador desloque o dia exibido.
export function formatDateOnly(value: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

// Aceita tanto o número quanto a string `numeric` que vem do banco. `empty` cobre as telas
// que preferem um traço a "R$ 0,00" quando o valor simplesmente não existe.
export function formatCurrency(value: string | number | null | undefined, empty?: string) {
  if (empty !== undefined && (value === null || value === undefined || value === '')) return empty
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Aceita a competência como "AAAA-MM"/"AAAA-MM-DD" ou um Date já pronto. A data é remontada
// pelas partes, no fuso local, para o mês exibido nunca escorregar por conversão de fuso.
export function formatMonthYear(value: string | Date) {
  const date =
    typeof value === 'string'
      ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1)
      : value
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

export type InputMask = 'cnpj' | 'cpf' | 'phone' | 'cep'

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
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
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
