import type { UserRole } from '@/types'

export const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  operador: 'Operador',
  super_admin: 'Super Admin',
}

export function roleLabel(role: string | null | undefined) {
  if (!role) return '—'
  return roleLabels[role as UserRole] ?? role
}

/** Admin e gerente são os papéis que podem cadastrar, editar e excluir dentro da empresa. */
export function isManagerRole(role: string | null | undefined) {
  return role === 'admin' || role === 'gerente'
}
