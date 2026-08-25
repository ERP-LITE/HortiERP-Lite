import bcrypt from 'bcryptjs'
import { and, eq, isNull, type InferSelectModel } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { companies, users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { comEscopoDePlataforma } from '../../db/scope.js'

type Company = InferSelectModel<typeof companies>

type UserWithCompany = InferSelectModel<typeof users> & { company: Company | null }

type UsableUser = InferSelectModel<typeof users> & { company: Company }

function assertAccountUsable(user: UserWithCompany | undefined, message: string): UsableUser {
  if (!user || !user.active) throw AppError.unauthorized(message)
  const { company } = user
  if (!company || !company.active || company.deletedAt) throw AppError.unauthorized(message)
  return { ...user, company }
}

export async function authenticateUser(email: string, password: string) {
  // Travessia declarada: o e-mail é único global e nesta consulta ainda não existe sessão nem empresa.
  return comEscopoDePlataforma(() => localizarParaLogin(email, password))
}

async function localizarParaLogin(email: string, password: string) {
  const found = await db.query.users.findFirst({
    where: and(eq(users.email, email), isNull(users.deletedAt)),
    with: { company: true },
  })

  const user = assertAccountUsable(found, 'E-mail ou senha incorretos')

  const passwordMatches = await bcrypt.compare(password, user.passwordHash)

  if (!passwordMatches) {
    throw AppError.unauthorized('E-mail ou senha incorretos')
  }

  return user
}

export async function getUserProfile(companyId: string, userId: string) {
  const found = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.companyId, companyId), isNull(users.deletedAt)),
    with: { company: true },
  })

  return assertAccountUsable(found, 'Usuário não encontrado')
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
