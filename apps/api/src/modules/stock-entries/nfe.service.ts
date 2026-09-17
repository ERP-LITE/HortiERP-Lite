import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { products, supplierProductCodes } from '../../db/schema/index.js'
import { lerNotaFiscal, type ItemDaNota } from './nfe.js'

export type OrigemDoVinculo = 'codigo-de-barras' | 'de-para' | null

export type ItemConferido = ItemDaNota & {
  productId: string | null
  productName: string | null
  vinculadoPor: OrigemDoVinculo
}

export type NotaConferida = {
  emitenteDocumento: string | null
  emitenteNome: string | null
  numero: string | null
  serie: string | null
  chaveDeAcesso: string | null
  emitidaEm: string | null
  valorTotal: number | null
  itens: ItemConferido[]
}

/**
 * O código do fornecedor é guardado sem espaços e em maiúsculas para a busca não depender de como
 * ele veio digitado na nota. Normalizar aqui, na borda, mantém o índice único simples.
 */
export function normalizarCodigoDoFornecedor(codigo: string | null | undefined) {
  const limpo = (codigo ?? '').trim().toUpperCase()
  return limpo || null
}

function porCodigoDeBarras(companyId: string, codigos: string[]) {
  if (codigos.length === 0) return Promise.resolve([])
  return db
    .select({ id: products.id, name: products.name, barcode: products.barcode })
    .from(products)
    .where(
      and(
        eq(products.companyId, companyId),
        isNull(products.deletedAt),
        eq(products.active, true),
        inArray(products.barcode, codigos),
      ),
    )
}

function porDePara(companyId: string, documento: string | null, codigos: string[]) {
  if (documento === null || codigos.length === 0) return Promise.resolve([])
  return db
    .select({ code: supplierProductCodes.supplierCode, id: products.id, name: products.name })
    .from(supplierProductCodes)
    .innerJoin(products, eq(products.id, supplierProductCodes.productId))
    .where(
      and(
        eq(supplierProductCodes.companyId, companyId),
        eq(supplierProductCodes.supplierDocument, documento),
        inArray(supplierProductCodes.supplierCode, codigos),
        isNull(products.deletedAt),
        eq(products.active, true),
      ),
    )
}

/**
 * Lê o XML e tenta casar cada item com um produto da loja. Duas camadas, nesta ordem: o código de
 * barras da nota contra o cadastro, e depois o "de para" aprendido com esse fornecedor. Item que não
 * casa volta sem produto, para a pessoa escolher na tela.
 */
export async function conferirNotaFiscal(companyId: string, xml: string): Promise<NotaConferida> {
  const nota = lerNotaFiscal(xml)

  const codigosDeBarras = [...new Set(nota.itens.map((item) => item.codigoDeBarras).filter((v): v is string => v !== null))]
  const codigosDoFornecedor = [
    ...new Set(
      nota.itens
        .map((item) => normalizarCodigoDoFornecedor(item.codigoDoFornecedor))
        .filter((v): v is string => v !== null),
    ),
  ]

  const [porBarras, porVinculo] = await Promise.all([
    porCodigoDeBarras(companyId, codigosDeBarras),
    porDePara(companyId, nota.emitenteDocumento, codigosDoFornecedor),
  ])

  // Código de barras não é único no cadastro. Repetido em dois produtos, ninguém sabe qual é o certo:
  // some do mapa e o item cai para a escolha da pessoa, em vez de casar com um deles em silêncio.
  const produtoPorBarras = new Map<string, (typeof porBarras)[number]>()
  const barrasAmbiguo = new Set<string>()
  for (const linha of porBarras) {
    if (linha.barcode === null) continue
    if (produtoPorBarras.has(linha.barcode)) barrasAmbiguo.add(linha.barcode)
    produtoPorBarras.set(linha.barcode, linha)
  }
  for (const codigo of barrasAmbiguo) produtoPorBarras.delete(codigo)

  const produtoPorCodigo = new Map(porVinculo.map((linha) => [linha.code, linha]))

  const itens = nota.itens.map((item): ItemConferido => {
    const codigoNormalizado = normalizarCodigoDoFornecedor(item.codigoDoFornecedor)
    const achadoPorBarras = item.codigoDeBarras === null ? undefined : produtoPorBarras.get(item.codigoDeBarras)
    const achadoPorVinculo = codigoNormalizado === null ? undefined : produtoPorCodigo.get(codigoNormalizado)
    const achado = achadoPorBarras ?? achadoPorVinculo

    return {
      ...item,
      productId: achado?.id ?? null,
      productName: achado?.name ?? null,
      vinculadoPor: achado === undefined ? null : achadoPorBarras ? 'codigo-de-barras' : 'de-para',
    }
  })

  return { ...nota, itens }
}

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Guarda o que a pessoa confirmou na tela: daqui em diante, aquele código daquele fornecedor entra
 * sozinho. É por isso que não existe tela separada de "de para": a confirmação da entrada já é a
 * resposta, e uma tela a mais seria pedir a mesma informação duas vezes.
 */
export async function aprenderVinculos(
  executor: Executor,
  companyId: string,
  userId: string,
  supplierDocument: string | null | undefined,
  vinculos: { supplierCode?: string | null; productId: string }[],
) {
  const documento = (supplierDocument ?? '').replace(/\D/g, '')
  if (!documento) return

  const porCodigo = new Map<string, string>()
  for (const vinculo of vinculos) {
    const codigo = normalizarCodigoDoFornecedor(vinculo.supplierCode)
    // A última linha ganha: numa nota com o mesmo código duas vezes, vale o que a pessoa escolheu
    // por último, e sem isto o ON CONFLICT quebraria com duas linhas iguais no mesmo comando.
    if (codigo !== null) porCodigo.set(codigo, vinculo.productId)
  }
  if (porCodigo.size === 0) return

  await executor
    .insert(supplierProductCodes)
    .values(
      [...porCodigo].map(([supplierCode, productId]) => ({
        companyId,
        supplierDocument: documento,
        supplierCode,
        productId,
        createdBy: userId,
        updatedBy: userId,
      })),
    )
    .onConflictDoUpdate({
      target: [
        supplierProductCodes.companyId,
        supplierProductCodes.supplierDocument,
        supplierProductCodes.supplierCode,
      ],
      set: { productId: sql`excluded.product_id`, updatedBy: userId, updatedAt: new Date() },
    })
}
