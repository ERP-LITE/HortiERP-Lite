import bcrypt from 'bcryptjs'
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users } from '../../db/schema/index.js'
import { assertUniqueField } from '../../shared/db/assertUniqueField.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { AppError } from '../../shared/errors/AppError.js'
import type {
  CreatePlatformUserInput,
  ListPlatformUsersQuery,
  UpdatePlatformUserInput,
} from './platform-users.schema.js'

const publicColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  active: users.active,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
}

function assertUniqueEmail(email: string, excludeId?: string) {
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

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === '23505'
}

async function getPlatformUser(companyId: string, id: string) {
  const [user] = await db
    .select(publicColumns)
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

  const [data, [{ total }]] = await Promise.all([
    db
      .select(publicColumns)
      .from(users)
      .where(where)
      .orderBy(asc(users.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(users).where(where),
  ])

  return buildPaginatedResult(data, total, query.page, query.pageSize)
}

export async function createPlatformUser(companyId: string, requesterId: string, data: CreatePlatformUserInput) {
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
        role: 'super_admin',
        createdBy: requesterId,
      })
      .returning(publicColumns)

    return user
  } catch (error) {
    if (isUniqueViolation(error)) throw AppError.duplicate('email', 'Já existe um usuário com esse e-mail')
    throw error
  }
}

export async function updatePlatformUser(
  companyId: string,
  requesterId: string,
  id: string,
  data: UpdatePlatformUserInput,
) {
  await getPlatformUser(companyId, id)
  if (data.email) await assertUniqueEmail(data.email, id)
  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined

  try {
    const [user] = await db
      .update(users)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(passwordHash && { passwordHash }),
        updatedBy: requesterId,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), eq(users.companyId, companyId), eq(users.role, 'super_admin')))
      .returning(publicColumns)

    return user
  } catch (error) {
    if (isUniqueViolation(error)) throw AppError.duplicate('email', 'Já existe um usuário com esse e-mail')
    throw error
  }
}

export async function deletePlatformUser(companyId: string, requesterId: string, id: string) {
  if (id === requesterId) throw AppError.conflict('Você não pode excluir a própria conta')
  await getPlatformUser(companyId, id)

  await db
    .update(users)
    .set({ deletedAt: new Date(), active: false, updatedBy: requesterId, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.companyId, companyId), eq(users.role, 'super_admin')))
}
