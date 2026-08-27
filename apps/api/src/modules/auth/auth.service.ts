import bcrypt from 'bcryptjs'
import { and, eq, isNull, type InferSelectModel } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { companies, users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { comEscopoDePlataforma } from '../../db/scope.js'

type Company = InferSelectModel<typeof companies>

type UserWithCompany = InferSelectModel<typeof users> & { company: Company | null }

type UsableUser = InferSelectModel<typeof users> & { company: Company }

function isAccountUsable(user: UserWithCompany | undefined): UsableUser | null {
  if (!user || !user.active) return null
  const { company } = user
  if (!company || !company.active || company.deletedAt) return null
  return { ...user, company }
}

function assertAccountUsable(user: UserWithCompany | undefined, message: string): UsableUser {
  const usable = isAccountUsable(user)
  if (!usable) throw AppError.unauthorized(message)
  return usable
}

export async function authenticateUser(email: string, password: string) {
  // Travessia declarada: o e-mail é único global e ainda não existe sessão.
  return comEscopoDePlataforma(() => localizarParaLogin(email, password))
}

/**
 * Hash de uma senha aleatória que ninguém conhece. Existe para o `bcrypt.compare` rodar mesmo
 * quando a conta não serve, gastando o mesmo tempo de CPU: sem isso, e-mail inexistente responde em
 * poucos milissegundos e e-mail real demora o tempo do bcrypt, o que entrega a lista de quem tem
 * conta a quem cronometrar as respostas.
 */
const HASH_DE_DESCARTE = '$2a$10$Uue7ZegyZVimRb.z6mrtDeZv623DUsMjfoWq8wauEHrPyCKL6HF1m'

async function localizarParaLogin(email: string, password: string) {
  const found = await db.query.users.findFirst({
    where: and(eq(users.email, email), isNull(users.deletedAt)),
    with: { company: true },
  })

  const contaUsavel = isAccountUsable(found)
  const passwordMatches = await bcrypt.compare(password, contaUsavel?.passwordHash ?? HASH_DE_DESCARTE)

  if (!contaUsavel || !passwordMatches) {
    throw AppError.unauthorized('E-mail ou senha incorretos')
  }

  return contaUsavel
}

// Travessia declarada: durante impersonação a conta de quem está logado é de outra empresa.
export async function getUserProfile(companyId: string, userId: string) {
  return comEscopoDePlataforma(() => localizarPerfil(companyId, userId))
}

async function localizarPerfil(companyId: string, userId: string) {
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

  await comEscopoDePlataforma(() =>
    db
      .update(users)
      .set({ passwordHash, passwordChangedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.companyId, companyId))),
  )
}
