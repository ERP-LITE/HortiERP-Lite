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
