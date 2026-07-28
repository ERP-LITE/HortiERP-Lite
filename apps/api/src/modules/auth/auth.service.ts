import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'

export async function authenticateUser(email: string, password: string) {
  const user = await db.query.users.findFirst({
    where: and(eq(users.email, email), isNull(users.deletedAt)),
  })

  if (!user || !user.active) {
    throw AppError.unauthorized('Credenciais inválidas')
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash)

  if (!passwordMatches) {
    throw AppError.unauthorized('Credenciais inválidas')
  }

  return user
}

export async function getUserProfile(companyId: string, userId: string) {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.companyId, companyId), isNull(users.deletedAt)),
  })

  if (!user || !user.active) {
    throw AppError.unauthorized('Usuário não encontrado')
  }

  return user
}

export async function changeOwnPassword(
  companyId: string,
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await getUserProfile(companyId, userId)

  const currentPasswordMatches = await bcrypt.compare(currentPassword, user.passwordHash)

  if (!currentPasswordMatches) {
    throw new AppError('Senha atual incorreta', 400, 'INVALID_CURRENT_PASSWORD')
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.companyId, companyId)))
}
