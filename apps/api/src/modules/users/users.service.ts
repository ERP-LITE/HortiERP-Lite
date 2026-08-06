import bcrypt from 'bcryptjs'
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { softDeleteById, softDeleteByIds } from '../../shared/db/softDelete.js'
import { assertUniqueUserEmail, userPublicColumns } from '../../shared/db/userPublicColumns.js'
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schema.js'

export async function listUsers(companyId: string, query: ListUsersQuery) {
  const conditions = [eq(users.companyId, companyId), isNull(users.deletedAt)]
  if (query.search) conditions.push(or(ilike(users.name, `%${query.search}%`), ilike(users.email, `%${query.search}%`))!)
  if (query.role) conditions.push(eq(users.role, query.role))
  if (query.active !== undefined) conditions.push(eq(users.active, query.active))
  const where = and(...conditions)

  const [data, [{ total }]] = await Promise.all([
    db
      .select(userPublicColumns)
      .from(users)
      .where(where)
      .orderBy(asc(users.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(users).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function getUser(companyId: string, id: string) {
  const [user] = await db
    .select(userPublicColumns)
    .from(users)
    .where(and(eq(users.id, id), eq(users.companyId, companyId), isNull(users.deletedAt)))

  if (!user) throw AppError.notFound('Usuário não encontrado')

  return user
}

export async function createUser(companyId: string, requesterId: string, data: CreateUserInput) {
  await assertUniqueUserEmail(data.email)

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
    .returning(userPublicColumns)

  return user
}

export async function updateUser(companyId: string, requesterId: string, id: string, data: UpdateUserInput) {
  await getUser(companyId, id)
  if (data.email) await assertUniqueUserEmail(data.email, id)

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
    .returning(userPublicColumns)

  return user
}

export async function deleteUser(companyId: string, requesterId: string, id: string) {
  if (id === requesterId) throw AppError.conflict('Você não pode excluir a própria conta')
  await getUser(companyId, id)
  await softDeleteById(users, companyId, requesterId, id, { active: false })
}

export async function deleteUsers(companyId: string, requesterId: string, ids: string[]) {
  const filteredIds = ids.filter((id) => id !== requesterId)
  return softDeleteByIds(users, companyId, requesterId, filteredIds, { active: false })
}
