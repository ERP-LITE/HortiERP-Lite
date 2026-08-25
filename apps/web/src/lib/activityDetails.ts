import { formatQuantity } from './format'
import { reasonLabel } from './losses'
import { roleLabel } from './roles'

const fieldLabels: Record<string, string> = {
  motivo: 'Motivo',
  observacoes: 'Observações',
  perfil: 'Perfil de acesso',
  senhaAlterada: 'Senha alterada',
  quantidadeEstornada: 'Quantidade devolvida ao estoque',
  produtos: 'Produtos importados',
  comEstoqueInicial: 'Com estoque inicial',
  categoriasCriadas: 'Categorias criadas',
  unidadesCriadas: 'Unidades criadas',
}

function humanize(key: string) {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : 'Nenhuma'
  if (key === 'perfil') return roleLabel(String(value))
  if (key === 'motivo') return reasonLabel(String(value))
  if (typeof value === 'string' && /^-?\d+\.\d+$/.test(value)) return formatQuantity(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function describeActivityDetails(details: Record<string, unknown> | null | undefined) {
  if (!details) return []
  return Object.entries(details).map(([key, value]) => ({
    label: fieldLabels[key] ?? humanize(key),
    value: formatValue(key, value),
  }))
}

export function activityDetailsText(details: Record<string, unknown> | null | undefined) {
  return describeActivityDetails(details)
    .map((item) => `${item.label}: ${item.value}`)
    .join(' · ')
}
