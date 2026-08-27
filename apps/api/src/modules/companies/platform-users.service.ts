import bcrypt from 'bcryptjs'
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm'
import { orderByColumn } from '../../shared/db/sorting.js'
import { db } from '../../db/client.js'
import { users } from '../../db/schema/index.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { assertUniqueUserEmail, userPublicColumns } from '../../shared/db/userPublicColumns.js'
import { AppError } from '../../shared/errors/AppError.js'
import type {
  CreatePlatformUserInput,
  ListPlatformUsersQuery,
  UpdatePlatformUserInput,
} from './platform-users.schema.js'

async function getPlatformUser(companyId: string, id: string) {
  const [user] = await db
    .select(userPublicColumns)
    .from(users)
    .where(
      and(eq(users.id, id), eq(users.companyId, companyId), eq(users.role, 'super_admin'), isNull(users.deletedAt)),
    )

  if (!user) throw AppError.notFound('Super administrador não encontrado')
  return user
}

export async function listPlatformUsers(companyId: string, query: ListPlatformUsersQuery) {
  const conditions = [eq(users.companyId, companyId), eq(users.role, 'super_admin'), isNull(users.deletedAt)]
  if (query.search) conditions.push(or(ilike(users.name, `%${query.search}%`), ilike(users.email, `%${query.search}%`))!)
  const where = and(...conditions)
  const orderBy = orderByColumn(query.sortBy ? users[query.sortBy] : users.name, query.sortOrder)

  const [data, [{ total }]] = await Promise.all([
    db
      .select(userPublicColumns)
      .from(users)
      .where(where)
      .orderBy(orderBy, asc(users.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(users).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function createPlatformUser(companyId: string, requesterId: string, data: CreatePlatformUserInput) {
  await assertUniqueUserEmail(data.email)
  const passwordHash = await bcrypt.hash(data.password, 10)

  const [user] = await db
    .insert(users)
    .values({
      companyId,
      name: data.name,
      email: data.email,
      passwordHash,
      passwordChangedAt: new Date(),
      role: 'super_admin',
      createdBy: requesterId,
    })
    .returning(userPublicColumns)

  return user
}

export async function updatePlatformUser(
  companyId: string,
  requesterId: string,
  id: string,
  data: UpdatePlatformUserInput,
) {
  await getPlatformUser(companyId, id)
  if (data.email) await assertUniqueUserEmail(data.email, { excludeId: id })
  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined

  const [user] = await db
    .update(users)
    .set({
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
      ...(passwordHash && { passwordHash, passwordChangedAt: new Date() }),
      updatedBy: requesterId,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, id), eq(users.companyId, companyId), eq(users.role, 'super_admin')))
    .returning(userPublicColumns)

  return user
}

export async function deletePlatformUser(companyId: string, requesterId: string, id: string) {
  if (id === requesterId) throw AppError.conflict('Você não pode excluir a própria conta')
  await getPlatformUser(companyId, id)

  await db
    .update(users)
    .set({ deletedAt: new Date(), active: false, updatedBy: requesterId, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.companyId, companyId), eq(users.role, 'super_admin')))
}
