import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createStockEntry } from './servicos.js'
import { authCookie, createTenant, setupTestApp } from './helpers.js'

const ctx = setupTestApp()

const BOUNDARY = '----hortierp-delivery-boundary'
const PDF_BYTES = Buffer.from('%PDF-1.4\n% teste\n')
const XML_BYTES = Buffer.from('<?xml version="1.0"?><nfeProc></nfeProc>')

function multipartBody(filename: string, contentType: string, content: Buffer) {
  return Buffer.concat([
    Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ])
}

/** Sobe uma entrada com um anexo e devolve o que é preciso para baixá-lo. */
async function createEntryWithAttachment(
  suffix: string,
  file: { filename: string; contentType: string; content: Buffer },
) {
  const tenant = await createTenant(suffix)
  const entry = await createStockEntry(tenant.companyId, tenant.operator.id, {
    items: [{ productId: tenant.productId, quantity: 1 }],
  })
  const cookie = authCookie(ctx.app, tenant.operator)

  const upload = await ctx.app.inject({
    method: 'POST',
    url: `/api/stock-entries/${entry.id}/attachments`,
    headers: { cookie, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    payload: multipartBody(file.filename, file.contentType, file.content),
  })
  assert.equal(upload.statusCode, 201, upload.body)

  return { tenant, cookie, entryId: entry.id, attachmentId: upload.json<{ id: string }>().id }
}

/**
 * Contrato de entrega dos anexos de nota fiscal. O `Content-Disposition` é o que decide
 * se o navegador baixa o arquivo ou o exibe na própria página, e é justamente disso que
 * a tela de detalhes depende para baixar e pré-visualizar.
 */
describe('entrega de anexo de nota fiscal', () => {
  it('download manda o navegador salvar o arquivo, com o nome original', async () => {
    const { cookie, entryId, attachmentId } = await createEntryWithAttachment('baixar-pdf', {
      filename: 'danfe.pdf',
      contentType: 'application/pdf',
      content: PDF_BYTES,
    })

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-entries/${entryId}/attachments/${attachmentId}`,
      headers: { cookie },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['content-disposition'], "attachment; filename*=UTF-8''danfe.pdf")
    assert.equal(response.headers['content-type'], 'application/pdf')
    assert.equal(Number(response.headers['content-length']), PDF_BYTES.length)
    assert.deepEqual(response.rawPayload, PDF_BYTES)
  })

  it('nome com acento e espaço vai codificado no cabeçalho', async () => {
    const { cookie, entryId, attachmentId } = await createEntryWithAttachment('baixar-acento', {
      filename: 'nota fiscal março.pdf',
      contentType: 'application/pdf',
      content: PDF_BYTES,
    })

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-entries/${entryId}/attachments/${attachmentId}`,
      headers: { cookie },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(
      response.headers['content-disposition'],
      `attachment; filename*=UTF-8''${encodeURIComponent('nota fiscal março.pdf')}`,
    )
  })

  it('preview de PDF pede exibição na página', async () => {
    const { cookie, entryId, attachmentId } = await createEntryWithAttachment('preview-pdf', {
      filename: 'danfe.pdf',
      contentType: 'application/pdf',
      content: PDF_BYTES,
    })

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-entries/${entryId}/attachments/${attachmentId}?preview=true`,
      headers: { cookie },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['content-disposition']?.startsWith('inline;'), true)
    assert.deepEqual(response.rawPayload, PDF_BYTES)
  })

  it('XML nunca é exibido na página, mesmo pedindo preview', async () => {
    const { cookie, entryId, attachmentId } = await createEntryWithAttachment('preview-xml', {
      filename: 'nfe.xml',
      contentType: 'application/xml',
      content: XML_BYTES,
    })

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/stock-entries/${entryId}/attachments/${attachmentId}?preview=true`,
      headers: { cookie },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(
      response.headers['content-disposition']?.startsWith('attachment;'),
      true,
      'XML não está na lista de previsualizáveis e precisa continuar sendo baixado',
    )
  })

  it('resposta carrega os cabeçalhos que impedem o arquivo de virar página ativa', async () => {
    const { cookie, entryId, attachmentId } = await createEntryWithAttachment('cabecalhos', {
      filename: 'danfe.pdf',
      contentType: 'application/pdf',
      content: PDF_BYTES,
    })

    for (const url of [
      `/api/stock-entries/${entryId}/attachments/${attachmentId}`,
      `/api/stock-entries/${entryId}/attachments/${attachmentId}?preview=true`,
    ]) {
      const response = await ctx.app.inject({ method: 'GET', url, headers: { cookie } })
      assert.equal(response.headers['x-content-type-options'], 'nosniff', url)
      assert.equal(response.headers['content-security-policy'], "default-src 'none'; sandbox", url)
    }
  })
})

/**
 * A coluna "Nota fiscal" da listagem distingue três situações, e a ordenação precisa
 * acompanhar: sem nota, dados preenchidos sem arquivo, e arquivo anexado. Antes o
 * `invoiceStatus` era booleano, então "só os dados" e "anexada" caíam no mesmo grupo.
 */
describe('ordenação pela situação da nota fiscal', () => {
  it('separa sem nota, só os dados e com arquivo anexado', async () => {
    const tenant = await createTenant('ordem-nota')
    const cookie = authCookie(ctx.app, tenant.operator)

    const semNota = await createStockEntry(tenant.companyId, tenant.operator.id, {
      supplierName: 'Sem nota',
      items: [{ productId: tenant.productId, quantity: 1 }],
    })
    const soDados = await createStockEntry(tenant.companyId, tenant.operator.id, {
      supplierName: 'Só os dados',
      invoiceNumber: '123456',
      items: [{ productId: tenant.productId, quantity: 1 }],
    })
    const comArquivo = await createStockEntry(tenant.companyId, tenant.operator.id, {
      supplierName: 'Com arquivo',
      items: [{ productId: tenant.productId, quantity: 1 }],
    })
    const upload = await ctx.app.inject({
      method: 'POST',
      url: `/api/stock-entries/${comArquivo.id}/attachments`,
      headers: { cookie, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipartBody('danfe.pdf', 'application/pdf', PDF_BYTES),
    })
    assert.equal(upload.statusCode, 201, upload.body)

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/stock-entries?sortBy=invoiceStatus&sortOrder=asc',
      headers: { cookie },
    })

    assert.equal(response.statusCode, 200, response.body)
    const data = response.json<{ data: { id: string; attachments: unknown[]; invoiceNumber: string | null }[] }>().data
    assert.deepEqual(
      data.map((entry) => entry.id),
      [semNota.id, soDados.id, comArquivo.id],
    )
    assert.equal(data[1].attachments.length, 0)
    assert.equal(data[1].invoiceNumber, '123456')
    assert.equal(data[2].attachments.length, 1)
  })
})
