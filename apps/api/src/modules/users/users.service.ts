import bcrypt from 'bcryptjs'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { CreateUserInput, UpdateUserInput } from './users.schema.js'

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
  const passwordHash = await bcrypt.hash(data.password, 10)

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
}

export async function updateUser(companyId: string, requesterId: string, id: string, data: UpdateUserInput) {
  await getUser(companyId, id)

  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined

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
}

export async function deleteUser(companyId: string, requesterId: string, id: string) {
  await getUser(companyId, id)

  await db
    .update(users)
    .set({ deletedAt: new Date(), active: false, updatedBy: requesterId })
    .where(and(eq(users.id, id), eq(users.companyId, companyId)))
}
