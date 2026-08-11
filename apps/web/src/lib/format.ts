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
