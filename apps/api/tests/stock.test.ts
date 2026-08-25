import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq, sql } from 'drizzle-orm'
import { db } from './db.js'
import { losses, products, stockEntries, stockMovements } from '../src/db/schema/index.js'
import { createLoss } from './servicos.js'
import { createStockEntry } from './servicos.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

describe('saúde operacional', () => {
  test('health confirma banco e armazenamento fiscal', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/health' })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), {
      status: 'ok',
      checks: { database: 'ok', invoiceStorage: 'ok' },
    })
  })
})

describe('indicadores financeiros do dashboard', () => {
  test('valor da perda usa o custo registrado no momento da ocorrência', async () => {
    const tenant = await createTenant('dashboard-loss-value', '10')
    await db.update(products).set({ costPrice: '12.50' }).where(eq(products.id, tenant.productId))

    await createLoss(tenant.companyId, tenant.operator.id, {
      productId: tenant.productId,
      quantity: 2,
      reason: 'avariado',
    })

    await db.update(products).set({ costPrice: '99.00' }).where(eq(products.id, tenant.productId))

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard/summary',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })

    assert.equal(response.statusCode, 200)
    const summary = response.json<{ lossesInPeriod: { lossesCount: number; lossValue: number } }>()
    assert.equal(summary.lossesInPeriod.lossesCount, 1)
    assert.equal(summary.lossesInPeriod.lossValue, 25)
  })

  test('detalhamento por produto vem cortado nos maiores, com a sobra contada', async () => {
    const tenant = await createTenant('dashboard-top-n', '0')

    // 8 produtos com quantidades distintas e crescentes: o corte deve manter
    // os 5 maiores (80, 70, 60, 50, 40) e reportar 3 na sobra.
    const createdProducts = await db
      .insert(products)
      .values(
        Array.from({ length: 8 }, (_, index) => ({
          companyId: tenant.companyId,
          categoryId: tenant.categoryId,
          unitId: tenant.unitId,
          name: `Produto top ${index + 1}`,
          createdBy: tenant.admin.id,
        })),
      )
      .returning({ id: products.id, name: products.name })

    await createStockEntry(tenant.companyId, tenant.operator.id, {
      items: createdProducts.map((product, index) => ({ productId: product.id, quantity: (index + 1) * 10 })),
    })

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard/summary',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
    })

    assert.equal(response.statusCode, 200)
    const summary = response.json<{
      movementsTimeline: {
        entradaCount: number
        entradaByUnit: { quantity: number }[]
        entradaProducts: { productName: string; quantity: number }[]
        entradaOtherProductsCount: number
      }[]
      stockByCategory: { products: unknown[]; otherProductsCount: number; productCount: number }[]
    }>()

    const dayWithEntries = summary.movementsTimeline.find((day) => day.entradaCount > 0)
    assert.ok(dayWithEntries, 'esperava um dia com entradas na timeline')
    assert.equal(dayWithEntries.entradaProducts.length, 5)
    assert.equal(dayWithEntries.entradaOtherProductsCount, 3)
    assert.deepEqual(
      dayWithEntries.entradaProducts.map(({ quantity }) => quantity),
      [80, 70, 60, 50, 40],
    )

    // O corte é só do detalhamento: contagem e totais por unidade continuam
    // considerando os 8 produtos (10+20+...+80 = 360).
    assert.equal(dayWithEntries.entradaCount, 8)
    assert.equal(dayWithEntries.entradaByUnit[0].quantity, 360)

    // O produto do fixture entra na categoria sem ter movimento, somando 9.
    const [category] = summary.stockByCategory
    assert.equal(category.productCount, 9)
    assert.equal(category.products.length, 5)
    assert.equal(category.otherProductsCount, 3)
  })
})

describe('concorrência de estoque', () => {
  test('entradas simultâneas acumulam todas as quantidades sem perder atualização', async () => {
    const tenant = await createTenant('entries', '0')

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        createStockEntry(tenant.companyId, tenant.operator.id, {
          supplierName: `Fornecedor ${index}`,
          items: [{ productId: tenant.productId, quantity: 1 }],
        }),
      ),
    )

    const [product] = await db
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, tenant.productId))
    assert.equal(product.currentStock, '20.000')

    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.productId, tenant.productId))
    assert.equal(movements.length, 20)
  })

  test('perdas simultâneas nunca deixam estoque negativo', async () => {
    const tenant = await createTenant('losses', '10')

    const results = await Promise.allSettled([
      createLoss(tenant.companyId, tenant.operator.id, {
        productId: tenant.productId,
        quantity: 7,
        reason: 'avariado',
      }),
      createLoss(tenant.companyId, tenant.operator.id, {
        productId: tenant.productId,
        quantity: 7,
        reason: 'avariado',
      }),
    ])

    assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
    assert.equal(results.filter(({ status }) => status === 'rejected').length, 1)

    const [product] = await db
      .select({ currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, tenant.productId))
    assert.equal(product.currentStock, '3.000')

    const persistedLosses = await db.select().from(losses).where(eq(losses.productId, tenant.productId))
    assert.equal(persistedLosses.length, 1)
  })
})

describe('entradas e perdas: busca e integridade multiempresa', () => {
  test('listagens identificam pelo nome o usuário que registrou cada operação', async () => {
    const tenant = await createTenant('operation-author', '10')

    await createStockEntry(tenant.companyId, tenant.operator.id, {
      items: [{ productId: tenant.productId, quantity: 2 }],
    })
    await createLoss(tenant.companyId, tenant.admin.id, {
      productId: tenant.productId,
      quantity: 1,
      reason: 'avariado',
    })

    const entriesResponse = await ctx.app.inject({
      method: 'GET',
      url: '/api/stock-entries?page=1&pageSize=15',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
    })
    assert.equal(entriesResponse.statusCode, 200)
    const [entry] = entriesResponse.json<{
      data: {
        createdByUser: { id: string; name: string } | null
        items: { product: { unit: { abbreviation: string } } }[]
      }[]
    }>().data
    assert.deepEqual(entry.createdByUser, { id: tenant.operator.id, name: tenant.operator.name })
    assert.equal(entry.items[0]?.product.unit.abbreviation, 'uoperation-author')

    const lossesResponse = await ctx.app.inject({
      method: 'GET',
      url: '/api/losses?page=1&pageSize=15',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
    })
    assert.equal(lossesResponse.statusCode, 200)
    const [loss] = lossesResponse.json<{ data: { createdByUser: { id: string; name: string } | null }[] }>().data
    assert.deepEqual(loss.createdByUser, { id: tenant.admin.id, name: tenant.admin.name })
  })

  test('histórico de movimentações identifica o usuário responsável', async () => {
    const tenant = await createTenant('movement-author', '10')

    await createLoss(tenant.companyId, tenant.operator.id, {
      productId: tenant.productId,
      quantity: 1,
      reason: 'avariado',
    })

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/stock/movements?page=1&pageSize=15',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
    })
    assert.equal(response.statusCode, 200)

    const [movement] = response
      .json<{ data: { createdByUser: { id: string; name: string } | null }[] }>()
      .data
    assert.deepEqual(movement.createdByUser, { id: tenant.operator.id, name: tenant.operator.name })
  })

  test('entrada armazena dados fiscais e protege anexos por empresa', async () => {
    const tenant = await createTenant('invoice-owner')
    const outsider = await createTenant('invoice-outsider')
    const entry = await createStockEntry(tenant.companyId, tenant.operator.id, {
      supplierName: 'Fornecedor fiscal',
      invoiceNumber: '1234',
      invoiceSeries: '1',
      invoiceAccessKey: '1'.repeat(44),
      invoiceIssuedAt: new Date('2026-08-06T12:00:00.000Z'),
      invoiceTotal: 159.9,
      items: [{ productId: tenant.productId, quantity: 2 }],
    })

    const boundary = '----hortierp-test-boundary'
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="danfe.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      pngHeader,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const uploadResponse = await ctx.app.inject({
      method: 'POST',
      url: `/api/stock-entries/${entry.id}/attachments`,
      headers: {
        cookie: authCookie(ctx.app, tenant.operator),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartBody,
    })
    assert.equal(uploadResponse.statusCode, 201)
    const attachment = uploadResponse.json<Record<string, unknown> & { id: string; originalName: string }>()
    assert.equal(attachment.originalName, 'danfe.png')
    assert.equal('storedName' in attachment, false)
    assert.equal('companyId' in attachment, false)
    assert.equal('createdBy' in attachment, false)

    const detailsResponse = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-entries/${entry.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
    })
    assert.equal(detailsResponse.statusCode, 200)
    const details = detailsResponse.json<{
      invoiceNumber: string
      invoiceAccessKey: string
      invoiceTotal: string
      attachments: (Record<string, unknown> & { id: string })[]
    }>()
    assert.equal(details.invoiceNumber, '1234')
    assert.equal(details.invoiceAccessKey, '1'.repeat(44))
    assert.equal(details.invoiceTotal, '159.90')
    assert.equal(details.attachments.length, 1)
    assert.equal('storedName' in details.attachments[0]!, false)
    assert.equal('companyId' in details.attachments[0]!, false)

    const previewResponse = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-entries/${entry.id}/attachments/${attachment.id}?preview=true`,
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
    })
    assert.equal(previewResponse.statusCode, 200)
    assert.equal(previewResponse.headers['content-disposition']?.startsWith('inline;'), true)
    assert.deepEqual(previewResponse.rawPayload, pngHeader)

    const forbiddenResponse = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-entries/${entry.id}/attachments/${attachment.id}`,
      headers: { cookie: authCookie(ctx.app, outsider.operator) },
    })
    assert.equal(forbiddenResponse.statusCode, 404)

    const forbiddenDeleteResponse = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/stock-entries/${entry.id}/attachments/${attachment.id}`,
      headers: { cookie: authCookie(ctx.app, outsider.manager) },
    })
    assert.equal(forbiddenDeleteResponse.statusCode, 404)

    const operatorDeleteResponse = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/stock-entries/${entry.id}/attachments/${attachment.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
    })
    assert.equal(operatorDeleteResponse.statusCode, 403)

    const deleteResponse = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/stock-entries/${entry.id}/attachments/${attachment.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.manager) },
    })
    assert.equal(deleteResponse.statusCode, 204)

    const deletedAttachmentResponse = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-entries/${entry.id}/attachments/${attachment.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
    })
    assert.equal(deletedAttachmentResponse.statusCode, 404)
  })

  test('uploads simultâneos respeitam o limite de três anexos por entrada', async () => {
    const tenant = await createTenant('invoice-concurrency')
    const entry = await createStockEntry(tenant.companyId, tenant.operator.id, {
      items: [{ productId: tenant.productId, quantity: 1 }],
    })
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    const responses = await Promise.all(
      Array.from({ length: 4 }, (_, index) => {
        const boundary = `----hortierp-concurrency-${index}`
        const body = Buffer.concat([
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="danfe-${index}.png"\r\nContent-Type: image/png\r\n\r\n`,
          ),
          pngHeader,
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ])
        return ctx.app.inject({
          method: 'POST',
          url: `/api/stock-entries/${entry.id}/attachments`,
          headers: {
            cookie: authCookie(ctx.app, tenant.operator),
            'content-type': `multipart/form-data; boundary=${boundary}`,
          },
          payload: body,
        })
      }),
    )

    assert.equal(responses.filter(({ statusCode }) => statusCode === 201).length, 3)
    assert.equal(responses.filter(({ statusCode }) => statusCode === 422).length, 1)

    const detailsResponse = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-entries/${entry.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
    })
    assert.equal(detailsResponse.statusCode, 200)
    assert.equal(detailsResponse.json<{ attachments: unknown[] }>().attachments.length, 3)
  })

  test('admin e gerente editam somente os dados cadastrais e fiscais da entrada', async () => {
    const tenant = await createTenant('entry-edit')
    const outsider = await createTenant('entry-edit-outsider')
    const entry = await createStockEntry(tenant.companyId, tenant.operator.id, {
      supplierName: 'Fornecedor antigo',
      items: [{ productId: tenant.productId, quantity: 2, unitCost: 5 }],
    })

    const operatorResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/stock-entries/${entry.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { supplierName: 'Tentativa sem permissão' },
    })
    assert.equal(operatorResponse.statusCode, 403)

    const outsiderResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/stock-entries/${entry.id}`,
      headers: { cookie: authCookie(ctx.app, outsider.manager) },
      payload: { supplierName: 'Outra empresa' },
    })
    assert.equal(outsiderResponse.statusCode, 404)

    const invalidKeyResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/stock-entries/${entry.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.manager) },
      payload: { invoiceAccessKey: '123' },
    })
    assert.equal(invalidKeyResponse.statusCode, 422)

    const updateResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/stock-entries/${entry.id}`,
      headers: { cookie: authCookie(ctx.app, tenant.manager) },
      payload: {
        supplierName: 'Fornecedor corrigido',
        notes: 'Documento conferido',
        invoiceNumber: '9876',
        invoiceSeries: '2',
        invoiceAccessKey: '9'.repeat(44),
        invoiceIssuedAt: '2026-08-05T12:00:00.000Z',
        invoiceTotal: 250.75,
      },
    })
    assert.equal(updateResponse.statusCode, 200)
    const updated = updateResponse.json<{
      supplierName: string
      invoiceNumber: string
      invoiceTotal: string
      items: { productId: string; quantity: string; unitCost: string }[]
    }>()
    assert.equal(updated.supplierName, 'Fornecedor corrigido')
    assert.equal(updated.invoiceNumber, '9876')
    assert.equal(updated.invoiceTotal, '250.75')
    assert.deepEqual(updated.items.map(({ productId, quantity, unitCost }) => ({
      productId,
      quantity: Number(quantity),
      unitCost: Number(unitCost),
    })), [
      { productId: tenant.productId, quantity: 2, unitCost: 5 },
    ])
  })

  test('busca entradas por fornecedor e pelo nome do item', async () => {
    const tenant = await createTenant('entry-search')
    await createStockEntry(tenant.companyId, tenant.operator.id, {
      supplierName: 'Fornecedor Especial',
      items: [{ productId: tenant.productId, quantity: 2 }],
    })

    for (const search of ['Especial', 'Produto entry-search']) {
      const response = await ctx.app.inject({
        method: 'GET',
        url: `/api/stock-entries?page=1&pageSize=15&search=${encodeURIComponent(search)}`,
        headers: { cookie: authCookie(ctx.app, tenant.operator) },
      })
      assert.equal(response.statusCode, 200)
      assert.equal(response.json<{ total: number }>().total, 1)
    }
  })

  test('produto de outra empresa não pode ser usado em entrada nem perda', async () => {
    const tenantA = await createTenant('operation-a', '10')
    const tenantB = await createTenant('operation-b', '10')

    const entryResponse = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie: authCookie(ctx.app, tenantA.operator) },
      payload: { items: [{ productId: tenantB.productId, quantity: 1 }] },
    })
    assert.equal(entryResponse.statusCode, 404)

    const lossResponse = await ctx.app.inject({
      method: 'POST',
      url: '/api/losses',
      headers: { cookie: authCookie(ctx.app, tenantA.operator) },
      payload: { productId: tenantB.productId, quantity: 1, reason: 'avariado' },
    })
    assert.equal(lossResponse.statusCode, 404)

    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(stockEntries)
    assert.equal(Number(total), 0)
  })
})

describe('ajuste manual de estoque', () => {
  test('operador não pode ajustar estoque (exige admin ou gerente)', async () => {
    const tenant = await createTenant('adjust-role', '10')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock/adjust',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { items: [{ productId: tenant.productId, quantity: 7 }], notes: 'Contagem física' },
    })

    assert.equal(response.statusCode, 403)
  })

  test('admin ajusta o estoque, gera movimento tipo ajuste com o motivo e delta corretos', async () => {
    const tenant = await createTenant('adjust-ok', '10')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock/adjust',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { items: [{ productId: tenant.productId, quantity: 7 }], notes: 'Contagem física apontou divergência' },
    })

    assert.equal(response.statusCode, 201)
    const movements = response.json<{ type: string; quantity: string; balanceAfter: string; notes: string }[]>()
    assert.equal(movements.length, 1)
    assert.equal(movements[0].type, 'ajuste')
    assert.equal(Number(movements[0].quantity), -3)
    assert.equal(Number(movements[0].balanceAfter), 7)
    assert.equal(movements[0].notes, 'Contagem física apontou divergência')

    const [product] = await db.select({ currentStock: products.currentStock }).from(products).where(eq(products.id, tenant.productId))
    assert.equal(Number(product.currentStock), 7)
  })

  test('ajusta múltiplos produtos numa única chamada, pulando quem não mudou', async () => {
    const tenant = await createTenant('adjust-bulk', '10')
    const [secondProduct] = await db
      .insert(products)
      .values({
        companyId: tenant.companyId,
        categoryId: tenant.categoryId,
        unitId: tenant.unitId,
        name: 'Produto adjust-bulk 2',
        currentStock: '5',
        createdBy: tenant.admin.id,
      })
      .returning({ id: products.id })

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock/adjust',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: {
        notes: 'Contagem física do inventário mensal',
        items: [
          { productId: tenant.productId, quantity: 10 }, // igual ao atual, deve ser ignorado
          { productId: secondProduct.id, quantity: 8 }, // muda de 5 para 8
        ],
      },
    })

    assert.equal(response.statusCode, 201)
    const movements = response.json<{ productId: string; quantity: string; balanceAfter: string }[]>()
    assert.equal(movements.length, 1)
    assert.equal(movements[0].productId, secondProduct.id)
    assert.equal(Number(movements[0].quantity), 3)

    const [unchanged] = await db.select({ currentStock: products.currentStock }).from(products).where(eq(products.id, tenant.productId))
    assert.equal(Number(unchanged.currentStock), 10)
    const [changed] = await db.select({ currentStock: products.currentStock }).from(products).where(eq(products.id, secondProduct.id))
    assert.equal(Number(changed.currentStock), 8)
  })

  test('rejeita ajuste quando nenhum item muda a quantidade', async () => {
    const tenant = await createTenant('adjust-noop', '10')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock/adjust',
      headers: { cookie: authCookie(ctx.app, tenant.admin) },
      payload: { items: [{ productId: tenant.productId, quantity: 10 }], notes: 'Sem mudança' },
    })

    assert.equal(response.statusCode, 422)
  })

  test('produto de outra empresa retorna 404 no ajuste', async () => {
    const tenantA = await createTenant('adjust-a', '10')
    const tenantB = await createTenant('adjust-b', '10')

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock/adjust',
      headers: { cookie: authCookie(ctx.app, tenantA.admin) },
      payload: { items: [{ productId: tenantB.productId, quantity: 5 }], notes: 'Tentativa cross-tenant' },
    })

    assert.equal(response.statusCode, 404)
  })
})
