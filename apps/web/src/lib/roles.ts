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
