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
