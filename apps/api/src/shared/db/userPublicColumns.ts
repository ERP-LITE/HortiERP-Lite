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

export function assertUniqueUserEmail(email: string, excludeId?: string) {
  return assertUniqueField({
    table: users,
    idColumn: users.id,
    valueColumn: users.email,
    value: email,
    excludeId,
    field: 'email',
    message: 'Já existe um usuário com esse e-mail',
  })
}
