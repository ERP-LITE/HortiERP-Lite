import type { LossReason } from '@/types'

export const reasonOptions: { value: LossReason; label: string }[] = [
  { value: 'vencido', label: 'Vencido' },
  { value: 'avariado', label: 'Avariado' },
  { value: 'roubo_furto', label: 'Roubo/Furto' },
  { value: 'erro_operacional', label: 'Erro operacional' },
  { value: 'outro', label: 'Outro' },
]

export const reasonLabels = Object.fromEntries(
  reasonOptions.map((option) => [option.value, option.label]),
) as Record<LossReason, string>

export function reasonLabel(reason: string | null | undefined) {
  if (!reason) return '—'
  return reasonLabels[reason as LossReason] ?? reason
}
