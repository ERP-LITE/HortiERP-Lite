import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { lerNotaFiscal } from '../src/modules/stock-entries/nfe.js'

const CHAVE = '35260914200166000187550010000000201000000017'

function item(valores: Partial<Record<string, string>> = {}) {
  const campos = {
    cProd: '007',
    cEAN: '7891234567890',
    xProd: 'TOMATE ITALIANO',
    uCom: 'KG',
    qCom: '10.0000',
    vUnCom: '5.5000000000',
    vProd: '55.00',
    ...valores,
  }
  const linhas = Object.entries(campos)
    .filter(([, valor]) => valor !== undefined)
    .map(([nome, valor]) => `<${nome}>${valor}</${nome}>`)
    .join('')
  return `<det nItem="1"><prod>${linhas}</prod></det>`
}

function nota(dets: string, opcoes: { envelope?: boolean; ide?: string } = {}) {
  const ide = opcoes.ide ?? '<nNF>20</nNF><serie>1</serie><dhEmi>2026-09-15T22:30:00-03:00</dhEmi><mod>55</mod>'
  const corpo = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
      <infNFe Id="NFe${CHAVE}" versao="4.00">
        <ide>${ide}</ide>
        <emit><CNPJ>14.200.166/0001-87</CNPJ><xNome>Hortifruti Fornecedor LTDA</xNome><xFant>Fornecedor Bom</xFant></emit>
        ${dets}
        <total><ICMSTot><vNF>55.00</vNF></ICMSTot></total>
      </infNFe>
    </NFe>`
  const xml = opcoes.envelope === false ? corpo : `<nfeProc versao="4.00">${corpo}<protNFe/></nfeProc>`
  return `<?xml version="1.0" encoding="UTF-8"?>${xml}`
}

describe('leitura da nota fiscal', () => {
  test('lê os dados da nota e do emitente', () => {
    const lida = lerNotaFiscal(nota(item()))

    assert.equal(lida.emitenteDocumento, '14200166000187')
    assert.equal(lida.emitenteNome, 'Fornecedor Bom')
    assert.equal(lida.numero, '20')
    assert.equal(lida.serie, '1')
    assert.equal(lida.chaveDeAcesso, CHAVE)
    assert.equal(lida.valorTotal, 55)
  })

  test('funciona com e sem o envelope de autorização', () => {
    const comEnvelope = lerNotaFiscal(nota(item()))
    const semEnvelope = lerNotaFiscal(nota(item(), { envelope: false }))
    assert.deepEqual(semEnvelope, comEnvelope)
  })

  test('nota de um item só não vira nota vazia', () => {
    const lida = lerNotaFiscal(nota(item()))
    assert.equal(lida.itens.length, 1)
    assert.equal(lida.itens[0].descricao, 'TOMATE ITALIANO')
  })

  test('nota de vários itens traz todos', () => {
    const lida = lerNotaFiscal(nota([item(), item({ xProd: 'ALFACE' }), item({ xProd: 'CENOURA' })].join('')))
    assert.deepEqual(lida.itens.map((i) => i.descricao), ['TOMATE ITALIANO', 'ALFACE', 'CENOURA'])
  })

  test('o código do fornecedor mantém os zeros da frente', () => {
    const lida = lerNotaFiscal(nota(item({ cProd: '007' })))
    assert.equal(lida.itens[0].codigoDoFornecedor, '007')
  })

  test('o valor unitário da nota é arredondado para duas casas', () => {
    const lida = lerNotaFiscal(nota(item({ vUnCom: '5.5555555555' })))
    assert.equal(lida.itens[0].valorUnitario, 5.56)
  })

  test('"SEM GTIN" não vira código de barras', () => {
    const lida = lerNotaFiscal(nota(item({ cEAN: 'SEM GTIN' })))
    assert.equal(lida.itens[0].codigoDeBarras, null)
  })

  test('código de barras fora do formato é descartado', () => {
    const lida = lerNotaFiscal(nota(item({ cEAN: '123' })))
    assert.equal(lida.itens[0].codigoDeBarras, null)
  })

  test('a data de emissão é a do fuso de quem emitiu, sem virar o dia', () => {
    const lida = lerNotaFiscal(nota(item()))
    assert.equal(lida.emitidaEm, '2026-09-15')
  })

  test('aceita o formato antigo, com data sem hora', () => {
    const lida = lerNotaFiscal(nota(item(), { ide: '<nNF>9</nNF><serie>1</serie><dEmi>2026-03-04</dEmi>' }))
    assert.equal(lida.emitidaEm, '2026-03-04')
  })

  test('item sem quantidade é ignorado em vez de entrar zerado', () => {
    const lida = lerNotaFiscal(nota([item(), item({ xProd: 'SEM QUANTIDADE', qCom: '0' })].join('')))
    assert.deepEqual(lida.itens.map((i) => i.descricao), ['TOMATE ITALIANO'])
  })
})

describe('arquivo que não serve', () => {
  test('arquivo que não é XML é recusado com mensagem em português', () => {
    assert.throws(() => lerNotaFiscal('isto não é um xml'), /Confira se é o XML da nota fiscal|não parece ser uma nota/)
  })

  test('XML que não é nota fiscal é recusado', () => {
    assert.throws(() => lerNotaFiscal('<?xml version="1.0"?><pedido><item/></pedido>'), /nota fiscal eletrônica/)
  })

  test('arquivo com DOCTYPE é recusado antes de ser interpretado', () => {
    const bomba = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]><nfeProc/>`
    assert.throws(() => lerNotaFiscal(bomba), /não será lido/)
  })

  test('nota sem item aproveitável é recusada', () => {
    assert.throws(() => lerNotaFiscal(nota(item({ qCom: '0' }))), /nenhum item/)
  })
})
