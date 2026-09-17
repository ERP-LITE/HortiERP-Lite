import { XMLParser } from 'fast-xml-parser'
import { AppError } from '../../shared/errors/AppError.js'

export type ItemDaNota = {
  codigoDoFornecedor: string | null
  codigoDeBarras: string | null
  descricao: string
  unidade: string | null
  quantidade: number
  valorUnitario: number | null
  valorTotal: number | null
}

export type NotaFiscalLida = {
  emitenteDocumento: string | null
  emitenteNome: string | null
  numero: string | null
  serie: string | null
  chaveDeAcesso: string | null
  emitidaEm: string | null
  valorTotal: number | null
  itens: ItemDaNota[]
}

/**
 * `parseTagValue: false` é obrigatório, não preferência: com a conversão automática, o código de
 * produto `007` viraria `7` e a chave de acesso perderia os zeros da frente. Tudo entra como texto e
 * a conversão para número acontece aqui, campo a campo.
 */
const leitor = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  removeNSPrefix: true,
})

const CHAVE_DE_ACESSO = /^\d{44}$/
const DATA_ISO = /^\d{4}-\d{2}-\d{2}/

function erroDeLeitura(mensagem: string) {
  return new AppError(mensagem, 422, 'XML_INVALIDO')
}

/** Um `<det>` só vem como objeto; dois ou mais, como lista. Ignorar isso quebra na nota de um item. */
function paraLista(valor: unknown): Record<string, unknown>[] {
  if (Array.isArray(valor)) return valor.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
  if (typeof valor === 'object' && valor !== null) return [valor as Record<string, unknown>]
  return []
}

function objeto(pai: unknown, chave: string): Record<string, unknown> | undefined {
  if (typeof pai !== 'object' || pai === null) return undefined
  const valor = (pai as Record<string, unknown>)[chave]
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : undefined
}

function texto(pai: unknown, chave: string): string | null {
  if (typeof pai !== 'object' || pai === null) return null
  const valor = (pai as Record<string, unknown>)[chave]
  if (typeof valor === 'string') return valor.trim() || null
  if (typeof valor === 'number') return String(valor)
  return null
}

function numero(pai: unknown, chave: string): number | null {
  const bruto = texto(pai, chave)
  if (bruto === null) return null
  const convertido = Number(bruto)
  return Number.isFinite(convertido) ? convertido : null
}

function duasCasas(valor: number | null): number | null {
  if (valor === null) return null
  return Math.round(valor * 100) / 100
}

function somenteDigitos(valor: string | null): string | null {
  if (valor === null) return null
  const digitos = valor.replace(/\D/g, '')
  return digitos || null
}

/** "SEM GTIN" é o texto que a própria NFe usa quando o item não tem código de barras. */
function codigoDeBarras(prod: Record<string, unknown>): string | null {
  const bruto = texto(prod, 'cEAN') ?? texto(prod, 'cEANTrib')
  if (bruto === null) return null
  const limpo = bruto.trim().toUpperCase()
  if (limpo === 'SEM GTIN' || limpo === 'SEMGTIN') return null
  return /^\d{8,14}$/.test(limpo) ? limpo : null
}

function chaveDaNota(infNFe: Record<string, unknown>): string | null {
  const atributo = typeof infNFe['@Id'] === 'string' ? infNFe['@Id'] : ''
  const digitos = atributo.replace(/\D/g, '')
  return CHAVE_DE_ACESSO.test(digitos) ? digitos : null
}

/**
 * A data vem como `dhEmi` com fuso (4.00) ou `dEmi` só com a data (3.10). Os dez primeiros
 * caracteres já são a data no fuso de quem emitiu, que é a data fiscal que interessa. Converter para
 * UTC aqui moveria a nota de dia nas emissões da noite.
 */
function dataDeEmissao(ide: Record<string, unknown>): string | null {
  const bruto = texto(ide, 'dhEmi') ?? texto(ide, 'dEmi')
  if (bruto === null || !DATA_ISO.test(bruto)) return null
  return bruto.slice(0, 10)
}

function lerItem(det: Record<string, unknown>): ItemDaNota | null {
  const prod = objeto(det, 'prod')
  if (!prod) return null

  const descricao = texto(prod, 'xProd')
  const quantidade = numero(prod, 'qCom')
  if (descricao === null || quantidade === null || quantidade <= 0) return null

  return {
    codigoDoFornecedor: texto(prod, 'cProd'),
    codigoDeBarras: codigoDeBarras(prod),
    descricao,
    unidade: texto(prod, 'uCom'),
    quantidade,
    // A nota traz até dez casas no valor unitário e a coluna guarda duas. O arredondamento pode
    // fazer quantidade × unitário não bater com o total da nota; por isso o total vem separado.
    valorUnitario: duasCasas(numero(prod, 'vUnCom')),
    valorTotal: duasCasas(numero(prod, 'vProd')),
  }
}

export function lerNotaFiscal(xml: string): NotaFiscalLida {
  // Nota fiscal eletrônica não tem DOCTYPE. Recusar antes de interpretar corta a classe de ataque em
  // que entidades declaradas no próprio arquivo se expandem uma dentro da outra até consumir a
  // memória do servidor.
  if (/<!DOCTYPE/i.test(xml)) {
    throw erroDeLeitura('O arquivo tem uma declaração que nota fiscal não usa e não será lido.')
  }

  let documento: unknown
  try {
    documento = leitor.parse(xml)
  } catch {
    throw erroDeLeitura('Não foi possível ler o arquivo. Confira se é o XML da nota fiscal.')
  }

  // O XML pode chegar com o envelope de autorização (`nfeProc`) ou só com a nota.
  const raiz = objeto(documento, 'nfeProc') ?? documento
  const nfe = objeto(raiz, 'NFe') ?? raiz
  const infNFe = objeto(nfe, 'infNFe')
  if (!infNFe) {
    throw erroDeLeitura('O arquivo não parece ser uma nota fiscal eletrônica. Envie o XML da NF-e.')
  }

  const ide = objeto(infNFe, 'ide') ?? {}
  const emit = objeto(infNFe, 'emit') ?? {}
  const total = objeto(objeto(infNFe, 'total'), 'ICMSTot') ?? {}

  const itens = paraLista(infNFe['det']).map(lerItem).filter((item): item is ItemDaNota => item !== null)
  if (itens.length === 0) {
    throw erroDeLeitura('A nota não tem nenhum item que o sistema consiga aproveitar.')
  }

  return {
    emitenteDocumento: somenteDigitos(texto(emit, 'CNPJ') ?? texto(emit, 'CPF')),
    emitenteNome: texto(emit, 'xFant') ?? texto(emit, 'xNome'),
    numero: texto(ide, 'nNF'),
    serie: texto(ide, 'serie'),
    chaveDeAcesso: chaveDaNota(infNFe),
    emitidaEm: dataDeEmissao(ide),
    valorTotal: duasCasas(numero(total, 'vNF')),
    itens,
  }
}
