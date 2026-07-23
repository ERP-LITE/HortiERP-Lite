import bcrypt from 'bcryptjs'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { CreateUserInput, UpdateUserInput } from './users.schema.js'

// email is globally unique at the DB level (not scoped by company), so the
// duplicate check below intentionally ignores deletedAt and companyId too.
async function assertUniqueEmail(email: string, excludeId?: string) {
  const conditions = [sql`lower(${users.email}) = lower(${email})`]
  if (excludeId) conditions.push(ne(users.id, excludeId))

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(...conditions))

  if (existing) throw AppError.duplicate('email', 'Já existe um usuário com esse e-mail')
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === '23505'
}

const publicColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  active: users.active,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
}

export async function listUsers(companyId: string) {
  return db
    .select(publicColumns)
    .from(users)
    .where(and(eq(users.companyId, companyId), isNull(users.deletedAt)))
    .orderBy(asc(users.name))
}

export async function getUser(companyId: string, id: string) {
  const [user] = await db
    .select(publicColumns)
    .from(users)
    .where(and(eq(users.id, id), eq(users.companyId, companyId), isNull(users.deletedAt)))

  if (!user) throw AppError.notFound('Usuário não encontrado')

  return user
}

export async function createUser(companyId: string, requesterId: string, data: CreateUserInput) {
  await assertUniqueEmail(data.email)

  const passwordHash = await bcrypt.hash(data.password, 10)

  try {
    const [user] = await db
      .insert(users)
      .values({
        companyId,
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
        active: data.active,
        createdBy: requesterId,
      })
      .returning(publicColumns)

    return user
  } catch (error) {
    if (isUniqueViolation(error)) throw AppError.duplicate('email', 'Já existe um usuário com esse e-mail')
    throw error
  }
}

export async function updateUser(companyId: string, requesterId: string, id: string, data: UpdateUserInput) {
  await getUser(companyId, id)
  if (data.email) await assertUniqueEmail(data.email, id)

  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined

  try {
    const [user] = await db
      .update(users)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(passwordHash && { passwordHash }),
        ...(data.role && { role: data.role }),
        ...(data.active !== undefined && { active: data.active }),
        updatedBy: requesterId,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), eq(users.companyId, companyId)))
      .returning(publicColumns)

    return user
  } catch (error) {
    if (isUniqueViolation(error)) throw AppError.duplicate('email', 'Já existe um usuário com esse e-mail')
    throw error
  }
}

export async function deleteUser(companyId: string, requesterId: string, id: string) {
  await getUser(companyId, id)

  await db
    .update(users)
    .set({ deletedAt: new Date(), active: false, updatedBy: requesterId })
    .where(and(eq(users.id, id), eq(users.companyId, companyId)))
}
