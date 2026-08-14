import bcrypt from 'bcryptjs'
import { and, asc, count, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import { orderByColumn } from '../../shared/db/sorting.js'
import { db } from '../../db/client.js'
import { users } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { buildPaginatedResult } from '../../shared/db/paginate.js'
import { softDeleteById, softDeleteByIds } from '../../shared/db/softDelete.js'
import { recordActivitySafe } from '../../shared/db/recordActivity.js'
import { assertUniqueUserEmail, userPublicColumns } from '../../shared/db/userPublicColumns.js'
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schema.js'

export async function listUsers(companyId: string, query: ListUsersQuery) {
  const conditions = [eq(users.companyId, companyId), isNull(users.deletedAt)]
  if (query.search) conditions.push(or(ilike(users.name, `%${query.search}%`), ilike(users.email, `%${query.search}%`))!)
  if (query.role) conditions.push(eq(users.role, query.role))
  if (query.active !== undefined) conditions.push(eq(users.active, query.active))
  const where = and(...conditions)
  // `role` não precisa de ordenação por rótulo: a ordem de declaração do enum
  // (admin → gerente → operador → super_admin) já coincide com a ordem
  // alfabética dos rótulos exibidos.
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

  await recordActivitySafe({
    companyId,
    actorId: requesterId,
    action: 'criou',
    entity: 'usuario',
    entityId: user.id,
    entityLabel: user.name,
    details: { perfil: data.role },
  })

  return user
}

export async function updateUser(companyId: string, requesterId: string, id: string, data: UpdateUserInput) {
  await getUser(companyId, id)

  // A tela de usuários exige `admin`, então quem edita é sempre o admin da empresa.
  // Deixar que ele se rebaixe ou se desative zerava os admins e trancava a empresa
  // fora da própria gestão de usuários — só um super_admin em impersonação
  // conseguiria reverter. Alterar OUTRO usuário nunca chega nesse estado, porque o
  // próprio solicitante continua admin ativo.
  if (id === requesterId) {
    if (data.role && data.role !== 'admin') {
      throw AppError.conflict('Você não pode alterar o seu próprio perfil de acesso')
    }
    if (data.active === false) {
      throw AppError.conflict('Você não pode desativar a própria conta')
    }
  }

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

  await recordActivitySafe({
    companyId,
    actorId: requesterId,
    action: 'alterou',
    entity: 'usuario',
    entityId: user.id,
    entityLabel: user.name,
    // Trocar a senha de outro usuário é a alteração mais sensível desta tela
    details: { senhaAlterada: Boolean(data.password) },
  })

  return user
}

export async function deleteUser(companyId: string, requesterId: string, id: string) {
  if (id === requesterId) throw AppError.conflict('Você não pode excluir a própria conta')
  const user = await getUser(companyId, id)
  await softDeleteById(users, companyId, requesterId, id, { active: false })
  await recordActivitySafe({
    companyId,
    actorId: requesterId,
    action: 'excluiu',
    entity: 'usuario',
    entityId: id,
    entityLabel: user.name,
  })
}

export async function deleteUsers(companyId: string, requesterId: string, ids: string[]) {
  const filteredIds = ids.filter((id) => id !== requesterId)
  // Os nomes são lidos antes da exclusão: depois o histórico não saberia dizer quem saiu.
  const removidos = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.companyId, companyId), inArray(users.id, filteredIds), isNull(users.deletedAt)))

  const result = await softDeleteByIds(users, companyId, requesterId, filteredIds, { active: false })

  for (const item of removidos) {
    await recordActivitySafe({
      companyId,
      actorId: requesterId,
      action: 'excluiu',
      entity: 'usuario',
      entityId: item.id,
      entityLabel: item.name,
    })
  }

  return result
}
