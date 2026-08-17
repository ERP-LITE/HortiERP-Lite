import { users } from '../../db/schema/index.js'
import { assertUniqueField } from './assertUniqueField.js'

export const userPublicColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  active: users.active,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
}

export function assertUniqueUserEmail(email: string, options: { excludeId?: string; field?: string } = {}) {
  return assertUniqueField({
    table: users,
    idColumn: users.id,
    valueColumn: users.email,
    deletedAtColumn: users.deletedAt,
    value: email,
    excludeId: options.excludeId,
    field: options.field ?? 'email',
    message: 'Já existe um usuário com esse e-mail',
  })
}
