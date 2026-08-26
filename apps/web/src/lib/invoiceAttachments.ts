import { formatFileSize } from './format'
import { LIMITES_TEXTO } from './limits'

export const MAX_INVOICE_ATTACHMENTS = 3

// Espelha INVOICE_MAX_FILE_SIZE da API (shared/config/env.ts). Mudou lá, muda aqui.
export const MAX_INVOICE_FILE_SIZE = 10 * 1024 * 1024

const CHAVE_NFE = new RegExp(`^\\d{${LIMITES_TEXTO.chaveNfe}}$`)

/** Mesma regra do `stock-entries.schema.ts`: chave incompleta é recusada antes de ir ao servidor. */
export function invoiceKeyError(value: string): string {
  if (!value) return ''
  return CHAVE_NFE.test(value) ? '' : `A chave da NF-e deve ter ${LIMITES_TEXTO.chaveNfe} dígitos`
}

export function invoiceSelectionError(files: File[], alreadyAttached = 0): string {
  if (!files.length) return ''
  if (alreadyAttached + files.length > MAX_INVOICE_ATTACHMENTS) {
    return `Cada entrada aceita no máximo ${MAX_INVOICE_ATTACHMENTS} anexos`
  }
  const grande = files.find((file) => file.size > MAX_INVOICE_FILE_SIZE)
  if (grande) {
    const limiteEmMegas = MAX_INVOICE_FILE_SIZE / 1024 / 1024
    return `${grande.name} tem ${formatFileSize(grande.size)} e o limite por arquivo é ${limiteEmMegas} MB`
  }
  return ''
}
