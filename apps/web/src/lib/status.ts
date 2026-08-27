import type { Genero } from './grammar'

export type { Genero }

export function statusLabel(active: boolean, genero: Genero = 'm') {
  if (genero === 'f') return active ? 'Ativa' : 'Inativa'
  return active ? 'Ativo' : 'Inativo'
}

const opcoesPorGenero: Record<Genero, { value: string; label: string }[]> = {
  m: [
    { value: 'todos', label: 'Todas as situações' },
    { value: 'true', label: 'Ativos' },
    { value: 'false', label: 'Inativos' },
  ],
  f: [
    { value: 'todos', label: 'Todas as situações' },
    { value: 'true', label: 'Ativas' },
    { value: 'false', label: 'Inativas' },
  ],
}

export function statusFilterOptionsFor(genero: Genero = 'm') {
  return opcoesPorGenero[genero]
}
