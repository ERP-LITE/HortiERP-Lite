import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { products, supplierProductCodes } from '../src/db/schema/index.js'
import { authCookie, createTenant, setupTestApp, type TenantFixture } from './helpers.js'

const ctx = setupTestApp()

const BOUNDARY = '----hortierp-nfe-boundary'
const CNPJ_FORNECEDOR = '14200166000187'

type ItemConferido = {
  descricao: string
  codigoDoFornecedor: string | null
  codigoDeBarras: string | null
  quantidade: number
  valorUnitario: number | null
  productId: string | null
  productName: string | null
  vinculadoPor: 'codigo-de-barras' | 'de-para' | null
}

type NotaConferida = {
  emitenteDocumento: string | null
  emitenteNome: string | null
  numero: string | null
  itens: ItemConferido[]
}

function xmlDaNota(itens: { cProd: string; cEAN: string; xProd: string }[]) {
  const dets = itens
    .map(
      (item, indice) => `<det nItem="${indice + 1}"><prod>
        <cProd>${item.cProd}</cProd><cEAN>${item.cEAN}</cEAN><xProd>${item.xProd}</xProd>
        <uCom>KG</uCom><qCom>10.0000</qCom><vUnCom>5.5000</vUnCom><vProd>55.00</vProd>
      </prod></det>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00"><NFe><infNFe Id="NFe35260914200166000187550010000000201000000017" versao="4.00">
      <ide><nNF>20</nNF><serie>1</serie><dhEmi>2026-09-15T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>${CNPJ_FORNECEDOR}</CNPJ><xNome>Fornecedor LTDA</xNome></emit>
      ${dets}
      <total><ICMSTot><vNF>55.00</vNF></ICMSTot></total>
    </infNFe></NFe></nfeProc>`
}

function corpoMultipart(filename: string, contentType: string, conteudo: string) {
  return Buffer.concat([
    Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    Buffer.from(conteudo),
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ])
}

function enviarXml(tenant: TenantFixture, conteudo: string, arquivo = { nome: 'nota.xml', tipo: 'application/xml' }) {
  return ctx.app.inject({
    method: 'POST',
    url: '/api/stock-entries/nfe',
    headers: {
      cookie: authCookie(ctx.app, tenant.operator),
      'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
    },
    payload: corpoMultipart(arquivo.nome, arquivo.tipo, conteudo),
  })
}

async function definirCodigoDeBarras(tenant: TenantFixture, codigo: string) {
  await db.update(products).set({ barcode: codigo }).where(eq(products.id, tenant.productId))
}

describe('leitura do XML na entrada de mercadoria', () => {
  test('casa o item pelo código de barras do cadastro', async () => {
    const tenant = await createTenant('nfe-barras')
    await definirCodigoDeBarras(tenant, '7891234567890')

    const resposta = await enviarXml(tenant, xmlDaNota([{ cProd: 'A1', cEAN: '7891234567890', xProd: 'TOMATE' }]))
    assert.equal(resposta.statusCode, 200, resposta.body)

    const nota = resposta.json<NotaConferida>()
    assert.equal(nota.emitenteDocumento, CNPJ_FORNECEDOR)
    assert.equal(nota.itens[0].productId, tenant.productId)
    assert.equal(nota.itens[0].vinculadoPor, 'codigo-de-barras')
  })

  test('item sem correspondência volta sem produto, para a pessoa escolher', async () => {
    const tenant = await createTenant('nfe-sem-casar')

    const resposta = await enviarXml(tenant, xmlDaNota([{ cProd: 'Z9', cEAN: '7899999999999', xProd: 'DESCONHECIDO' }]))
    const nota = resposta.json<NotaConferida>()

    assert.equal(nota.itens[0].productId, null)
    assert.equal(nota.itens[0].vinculadoPor, null)
  })

  test('o código de barras de outra empresa não casa', async () => {
    const vizinha = await createTenant('nfe-vizinha')
    await definirCodigoDeBarras(vizinha, '7891111111111')
    const tenant = await createTenant('nfe-isolada')

    const resposta = await enviarXml(tenant, xmlDaNota([{ cProd: 'A1', cEAN: '7891111111111', xProd: 'TOMATE' }]))

    assert.equal(resposta.json<NotaConferida>().itens[0].productId, null)
  })

  test('código de barras repetido em dois produtos não casa com nenhum', async () => {
    const tenant = await createTenant('nfe-barras-repetido')
    await definirCodigoDeBarras(tenant, '7891234567890')
    await db.insert(products).values({
      companyId: tenant.companyId,
      categoryId: tenant.categoryId,
      unitId: tenant.unitId,
      name: 'Outro com o mesmo código',
      barcode: '7891234567890',
      createdBy: tenant.admin.id,
    })

    const resposta = await enviarXml(tenant, xmlDaNota([{ cProd: 'A1', cEAN: '7891234567890', xProd: 'TOMATE' }]))
    const item = resposta.json<NotaConferida>().itens[0]

    assert.equal(item.productId, null, 'escolheu um produto sozinho com o código repetido')
    assert.equal(item.vinculadoPor, null)
  })

  test('arquivo que não é XML é recusado com mensagem em português', async () => {
    const tenant = await createTenant('nfe-arquivo-errado')

    const resposta = await enviarXml(tenant, '%PDF-1.4', { nome: 'nota.pdf', tipo: 'application/pdf' })

    assert.equal(resposta.statusCode, 422)
    assert.match(resposta.json<{ error: { message: string } }>().error.message, /XML da nota fiscal/)
  })
})

describe('o de para do fornecedor aprende sozinho', () => {
  test('confirmar a entrada ensina o vínculo, e a nota seguinte já vem casada', async () => {
    const tenant = await createTenant('nfe-aprende')
    const cookie = authCookie(ctx.app, tenant.operator)

    const primeira = await enviarXml(tenant, xmlDaNota([{ cProd: 'A1', cEAN: 'SEM GTIN', xProd: 'TOMATE' }]))
    assert.equal(primeira.json<NotaConferida>().itens[0].productId, null)

    const criada = await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie },
      payload: {
        supplierDocument: CNPJ_FORNECEDOR,
        items: [{ productId: tenant.productId, quantity: 10, unitCost: 5.5, supplierCode: 'A1' }],
      },
    })
    assert.equal(criada.statusCode, 201, criada.body)

    const segunda = await enviarXml(tenant, xmlDaNota([{ cProd: 'A1', cEAN: 'SEM GTIN', xProd: 'TOMATE' }]))
    const item = segunda.json<NotaConferida>().itens[0]
    assert.equal(item.productId, tenant.productId)
    assert.equal(item.vinculadoPor, 'de-para')
  })

  test('o código é guardado sem depender de maiúsculas', async () => {
    const tenant = await createTenant('nfe-maiusculas')

    await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: {
        supplierDocument: CNPJ_FORNECEDOR,
        items: [{ productId: tenant.productId, quantity: 1, supplierCode: ' a1 ' }],
      },
    })

    const resposta = await enviarXml(tenant, xmlDaNota([{ cProd: 'A1', cEAN: 'SEM GTIN', xProd: 'TOMATE' }]))
    assert.equal(resposta.json<NotaConferida>().itens[0].vinculadoPor, 'de-para')
  })

  test('mudar o produto do mesmo código corrige o vínculo em vez de duplicar', async () => {
    const tenant = await createTenant('nfe-corrige')
    const cookie = authCookie(ctx.app, tenant.operator)
    const [outro] = await db
      .insert(products)
      .values({
        companyId: tenant.companyId,
        categoryId: tenant.categoryId,
        unitId: tenant.unitId,
        name: 'Produto certo',
        createdBy: tenant.admin.id,
      })
      .returning({ id: products.id })

    for (const productId of [tenant.productId, outro.id]) {
      const resposta = await ctx.app.inject({
        method: 'POST',
        url: '/api/stock-entries',
        headers: { cookie },
        payload: { supplierDocument: CNPJ_FORNECEDOR, items: [{ productId, quantity: 1, supplierCode: 'A1' }] },
      })
      assert.equal(resposta.statusCode, 201, resposta.body)
    }

    const vinculos = await db
      .select({ productId: supplierProductCodes.productId })
      .from(supplierProductCodes)
      .where(eq(supplierProductCodes.companyId, tenant.companyId))

    assert.equal(vinculos.length, 1)
    assert.equal(vinculos[0].productId, outro.id)
  })

  test('entrada sem fornecedor no XML não cria vínculo solto', async () => {
    const tenant = await createTenant('nfe-sem-fornecedor')

    await ctx.app.inject({
      method: 'POST',
      url: '/api/stock-entries',
      headers: { cookie: authCookie(ctx.app, tenant.operator) },
      payload: { items: [{ productId: tenant.productId, quantity: 1, supplierCode: 'A1' }] },
    })

    const vinculos = await db
      .select({ id: supplierProductCodes.id })
      .from(supplierProductCodes)
      .where(eq(supplierProductCodes.companyId, tenant.companyId))

    assert.equal(vinculos.length, 0)
  })
})
