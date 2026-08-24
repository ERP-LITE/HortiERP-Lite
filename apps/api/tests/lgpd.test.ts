import assert from 'node:assert/strict'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { describe, test } from 'node:test'
import { and, eq } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import {
  activityLogs,
  companies,
  products,
  stockEntries,
  stockEntryAttachments,
  stockEntryItems,
  stockMovements,
  systemLogs,
  users,
} from '../src/db/schema/index.js'
import { env } from '../src/shared/config/env.js'
import {
  ANONYMIZED_USER_NAME,
  anonymizeDeletedUsers,
  daysAgo,
  purgeActivityLogs,
  purgeTechnicalLogs,
  runRetention,
} from '../src/modules/retention/retention.service.js'
import { collectCompanyFootprint, eraseCompanyData } from '../src/modules/companies/erase-company.service.js'
import { createStockEntry } from '../src/modules/stock-entries/stock-entries.service.js'
import { createLoss } from '../src/modules/losses/losses.service.js'
import { authCookie, createTenant, createUser, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

async function insertTechnicalLog(companyId: string, actorId: string, createdAt: Date) {
  await db.insert(systemLogs).values({
    companyId,
    actorId,
    method: 'GET',
    path: '/api/products',
    statusCode: 200,
    durationMs: 12,
    ip: '203.0.113.10',
    userAgent: 'teste',
    createdAt,
  })
}

async function insertActivityLog(
  companyId: string,
  actorId: string,
  createdAt: Date,
  overrides: { entity?: 'produto' | 'usuario'; entityId?: string; entityLabel?: string } = {},
) {
  await db.insert(activityLogs).values({
    companyId,
    actorId,
    action: 'criou',
    entity: overrides.entity ?? 'produto',
    entityId: overrides.entityId,
    entityLabel: overrides.entityLabel ?? 'Tomate',
    createdAt,
  })
}

describe('retenção de log técnico', () => {
  test('apaga o que passou do prazo e preserva o que está dentro', async () => {
    const tenant = await createTenant('retencao-tecnico')
    await insertTechnicalLog(tenant.companyId, tenant.admin.id, daysAgo(200))
    await insertTechnicalLog(tenant.companyId, tenant.admin.id, daysAgo(181))
    await insertTechnicalLog(tenant.companyId, tenant.admin.id, daysAgo(179))
    await insertTechnicalLog(tenant.companyId, tenant.admin.id, new Date())

    const removed = await purgeTechnicalLogs(daysAgo(180))
    assert.equal(removed, 2)

    const restantes = await db.select({ id: systemLogs.id }).from(systemLogs)
    assert.equal(restantes.length, 2)
  })

  test('dry-run conta sem apagar', async () => {
    const tenant = await createTenant('retencao-dryrun')
    await insertTechnicalLog(tenant.companyId, tenant.admin.id, daysAgo(300))

    const contados = await purgeTechnicalLogs(daysAgo(180), true)
    assert.equal(contados, 1)

    const restantes = await db.select({ id: systemLogs.id }).from(systemLogs)
    assert.equal(restantes.length, 1, 'dry-run não pode apagar nada')
  })
})

describe('retenção da trilha de auditoria', () => {
  test('apaga registro de atividade além do prazo fiscal', async () => {
    const tenant = await createTenant('retencao-auditoria')
    await insertActivityLog(tenant.companyId, tenant.admin.id, daysAgo(5 * 365 + 10))
    await insertActivityLog(tenant.companyId, tenant.admin.id, daysAgo(5 * 365 - 10))

    const removed = await purgeActivityLogs(daysAgo(5 * 365))
    assert.equal(removed, 1)
  })
})

describe('anonimização de usuário excluído', () => {
  test('anonimiza só quem passou do prazo, e limpa o nome no histórico', async () => {
    const tenant = await createTenant('anonimizacao')
    const antigo = await createUser(tenant.companyId, 'operador', 'saiu-ha-muito')
    const recente = await createUser(tenant.companyId, 'operador', 'saiu-agora')

    await db.update(users).set({ deletedAt: daysAgo(5 * 365 + 30) }).where(eq(users.id, antigo.id))
    await db.update(users).set({ deletedAt: daysAgo(10) }).where(eq(users.id, recente.id))

    // O nome da pessoa também mora no histórico de atividades, em `entityLabel`.
    await insertActivityLog(tenant.companyId, tenant.admin.id, new Date(), {
      entity: 'usuario',
      entityId: antigo.id,
      entityLabel: antigo.name,
    })

    const total = await anonymizeDeletedUsers(daysAgo(5 * 365))
    assert.equal(total, 1)

    const [anonimizado] = await db
      .select({ name: users.name, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, antigo.id))
    assert.equal(anonimizado.name, ANONYMIZED_USER_NAME)
    assert.ok(anonimizado.email.endsWith('@anonimizado.invalid'), `e-mail não anonimizado: ${anonimizado.email}`)
    assert.ok(!anonimizado.passwordHash.startsWith('$2'), 'o hash de senha precisa deixar de ser válido')

    const [preservado] = await db.select({ name: users.name }).from(users).where(eq(users.id, recente.id))
    assert.equal(preservado.name, recente.name, 'quem saiu dentro do prazo não pode ser anonimizado')

    const [logDoUsuario] = await db
      .select({ entityLabel: activityLogs.entityLabel })
      .from(activityLogs)
      .where(and(eq(activityLogs.entity, 'usuario'), eq(activityLogs.entityId, antigo.id)))
    assert.equal(logDoUsuario.entityLabel, ANONYMIZED_USER_NAME, 'o nome ficou legível no histórico')
  })

  test('não toca em usuário ativo e roda duas vezes sem duplicar trabalho', async () => {
    const tenant = await createTenant('anonimizacao-idempotente')
    const saiu = await createUser(tenant.companyId, 'operador', 'idem')
    await db.update(users).set({ deletedAt: daysAgo(5 * 365 + 1) }).where(eq(users.id, saiu.id))

    assert.equal(await anonymizeDeletedUsers(daysAgo(5 * 365)), 1)
    assert.equal(await anonymizeDeletedUsers(daysAgo(5 * 365)), 0, 'já anonimizado não pode entrar de novo')

    const [ativo] = await db.select({ name: users.name }).from(users).where(eq(users.id, tenant.admin.id))
    assert.equal(ativo.name, tenant.admin.name, 'usuário ativo não pode ser anonimizado')
  })

  /**
   * O login já ignora usuário com `deletedAt`, então testar o login logo após a anonimização não
   * provaria nada. O que precisa valer é a segunda tranca: se alguém reativar a conta direto no
   * banco, sem saber que ela foi anonimizada, a senha antiga ainda não pode funcionar.
   */
  test('conta reativada depois de anonimizada não aceita a senha antiga', async () => {
    const bcrypt = (await import('bcryptjs')).default
    const tenant = await createTenant('anonimizacao-login')
    const saiu = await createUser(tenant.companyId, 'operador', 'login')
    const email = 'operador-login@test.local'

    await db
      .update(users)
      .set({ deletedAt: daysAgo(5 * 365 + 1), passwordHash: await bcrypt.hash('senha-conhecida', 10) })
      .where(eq(users.id, saiu.id))

    // Antes de anonimizar, a senha casa — é isso que garante que o teste seguinte tem valor.
    const [antes] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, saiu.id))
    assert.ok(await bcrypt.compare('senha-conhecida', antes.passwordHash))

    await anonymizeDeletedUsers(daysAgo(5 * 365))

    // Alguém "ressuscita" a conta no banco.
    await db.update(users).set({ deletedAt: null }).where(eq(users.id, saiu.id))

    const resposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'senha-conhecida' },
    })
    assert.equal(resposta.statusCode, 401, 'a senha antiga não pode voltar a funcionar')
  })
})

describe('runRetention aplica os três prazos juntos', () => {
  test('resumo bate com o que foi apagado', async () => {
    const tenant = await createTenant('retencao-conjunta')
    await insertTechnicalLog(tenant.companyId, tenant.admin.id, daysAgo(200))
    await insertActivityLog(tenant.companyId, tenant.admin.id, daysAgo(5 * 365 + 5))
    const saiu = await createUser(tenant.companyId, 'operador', 'conjunta')
    await db.update(users).set({ deletedAt: daysAgo(5 * 365 + 5) }).where(eq(users.id, saiu.id))

    const resumo = await runRetention({ technicalLogRetentionDays: 180, auditRetentionDays: 5 * 365 })
    assert.deepEqual(resumo, { technicalLogs: 1, activityLogs: 1, anonymizedUsers: 1 })
  })
})

describe('exportação dos dados do próprio titular', () => {
  test('devolve o cadastro e só as atividades de quem pediu', async () => {
    const tenant = await createTenant('exportacao')
    await insertActivityLog(tenant.companyId, tenant.admin.id, new Date(), { entityLabel: 'Feita pelo admin' })
    await insertActivityLog(tenant.companyId, tenant.operator.id, new Date(), { entityLabel: 'Feita pelo operador' })
    await insertTechnicalLog(tenant.companyId, tenant.admin.id, new Date())

    const resposta = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me/personal-data',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })

    assert.equal(resposta.statusCode, 200)
    assert.match(resposta.headers['content-disposition'] as string, /attachment; filename="meus-dados-/)

    const corpo = resposta.json<{
      titular: { nome: string; email: string }
      atividades: { total: number; registros: { registro: string }[] }
      historicoDeAcesso: { total: number }
    }>()

    assert.equal(corpo.titular.nome, tenant.admin.name)
    assert.equal(corpo.atividades.total, 1, 'só a atividade do próprio titular entra')
    assert.equal(corpo.atividades.registros[0].registro, 'Feita pelo admin')
    assert.equal(corpo.historicoDeAcesso.total, 1)
    assert.ok(!JSON.stringify(corpo).includes('Feita pelo operador'), 'vazou atividade de outra pessoa')
    assert.ok(!JSON.stringify(corpo).includes('passwordHash'), 'o hash da senha não pode ser exportado')
  })

  test('exige sessão', async () => {
    const resposta = await ctx.app.inject({ method: 'GET', url: '/api/auth/me/personal-data' })
    assert.equal(resposta.statusCode, 401)
  })
})

describe('exclusão definitiva dos dados de uma empresa', () => {
  test('apaga tudo da empresa alvo, o arquivo do disco, e não encosta na outra', async () => {
    const alvo = await createTenant('erase-alvo', '100')
    const vizinha = await createTenant('erase-vizinha', '100')

    // Movimento real em cada empresa, para haver filho em todas as tabelas.
    for (const tenant of [alvo, vizinha]) {
      await createStockEntry(tenant.companyId, tenant.admin.id, {
        items: [{ productId: tenant.productId, quantity: 5, unitCost: 3 }],
        supplierName: 'Sítio do Zé',
      })
      await createLoss(tenant.companyId, tenant.operator.id, {
        productId: tenant.productId,
        quantity: 2,
        reason: 'avariado',
      })
      await insertTechnicalLog(tenant.companyId, tenant.admin.id, new Date())
    }

    // Um anexo de verdade, com arquivo no disco.
    const storedName = `${randomUUID()}.pdf`
    await mkdir(env.INVOICE_STORAGE_PATH, { recursive: true })
    const filePath = join(env.INVOICE_STORAGE_PATH, storedName)
    await writeFile(filePath, '%PDF-1.4 teste')
    const [entrada] = await db
      .select({ id: stockEntries.id })
      .from(stockEntries)
      .where(eq(stockEntries.companyId, alvo.companyId))
    await db.insert(stockEntryAttachments).values({
      companyId: alvo.companyId,
      stockEntryId: entrada.id,
      originalName: 'nota.pdf',
      storedName,
      mimeType: 'application/pdf',
      size: 14,
      createdBy: alvo.admin.id,
    })

    const footprint = await collectCompanyFootprint(alvo.companyId)
    assert.ok(footprint)
    assert.equal(footprint.volumes.usuarios, 3)
    assert.equal(footprint.volumes.anexos, 1)
    assert.ok(footprint.volumes.movimentacoes >= 2)

    const { removedFiles } = await eraseCompanyData(footprint)
    assert.equal(removedFiles, 1)

    await assert.rejects(access(filePath), 'o arquivo da nota fiscal precisa sair do disco')

    // Nada da empresa apagada pode restar em nenhuma tabela.
    for (const [nome, consulta] of [
      ['companies', db.select({ id: companies.id }).from(companies).where(eq(companies.id, alvo.companyId))],
      ['users', db.select({ id: users.id }).from(users).where(eq(users.companyId, alvo.companyId))],
      ['products', db.select({ id: products.id }).from(products).where(eq(products.companyId, alvo.companyId))],
      [
        'stock_movements',
        db.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.companyId, alvo.companyId)),
      ],
      [
        'stock_entries',
        db.select({ id: stockEntries.id }).from(stockEntries).where(eq(stockEntries.companyId, alvo.companyId)),
      ],
      [
        'activity_logs',
        db.select({ id: activityLogs.id }).from(activityLogs).where(eq(activityLogs.companyId, alvo.companyId)),
      ],
      [
        'system_logs',
        db.select({ id: systemLogs.id }).from(systemLogs).where(eq(systemLogs.companyId, alvo.companyId)),
      ],
    ] as const) {
      assert.equal((await consulta).length, 0, `sobrou linha em ${nome}`)
    }

    // Os itens da entrada não têm companyId: se a ordem de exclusão estivesse errada, sobrariam órfãos.
    const itensOrfaos = await db
      .select({ id: stockEntryItems.id, entryId: stockEntryItems.stockEntryId })
      .from(stockEntryItems)
    assert.equal(itensOrfaos.length, 1, 'devia restar apenas o item da empresa vizinha')

    // A vizinha continua intacta.
    const [vizinhaViva] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, vizinha.companyId))
    assert.ok(vizinhaViva, 'a empresa vizinha não podia ser tocada')
    const usuariosVizinha = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.companyId, vizinha.companyId))
    assert.equal(usuariosVizinha.length, 3)
  })

  test('empresa inexistente devolve nulo em vez de apagar às cegas', async () => {
    assert.equal(await collectCompanyFootprint(randomUUID()), null)
  })
})
