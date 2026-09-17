import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  dadosDaNota,
  itensDaNota,
  juntarArquivos,
  resumoDaLeitura,
  temItemPreenchido,
  textoDoResumo,
} from '../src/lib/invoiceXml'
import { invoiceSelectionError, MAX_INVOICE_ATTACHMENTS } from '../src/lib/invoiceAttachments'
import type { NotaFiscalLida } from '../src/types'

function nota(parcial: Partial<NotaFiscalLida> = {}): NotaFiscalLida {
  return {
    emitenteDocumento: '14200166000187',
    emitenteNome: 'Fornecedor Bom',
    numero: '20',
    serie: '1',
    chaveDeAcesso: '3'.repeat(44),
    emitidaEm: '2026-09-15',
    valorTotal: 55,
    itens: [
      {
        codigoDoFornecedor: 'A1',
        codigoDeBarras: '7891234567890',
        descricao: 'TOMATE ITALIANO',
        unidade: 'KG',
        quantidade: 10,
        valorUnitario: 5.5,
        valorTotal: 55,
        productId: 'produto-1',
        productName: 'Tomate',
        vinculadoPor: 'codigo-de-barras',
      },
    ],
    ...parcial,
  }
}

describe('itens vindos do XML', () => {
  test('o item ligado já chega com o produto escolhido', () => {
    const [item] = itensDaNota(nota())
    assert.equal(item.productId, 'produto-1')
    assert.equal(item.quantity, '10')
    assert.equal(item.unitCost, '5.5')
    assert.equal(item.supplierCode, 'A1')
  })

  test('o item sem produto chega em branco, mas guarda o que a nota dizia', () => {
    const lida = nota({
      itens: [
        {
          codigoDoFornecedor: 'Z9',
          codigoDeBarras: null,
          descricao: 'ALFACE CRESPA',
          unidade: 'UN',
          quantidade: 3,
          valorUnitario: null,
          valorTotal: null,
          productId: null,
          productName: null,
          vinculadoPor: null,
        },
      ],
    })

    const [item] = itensDaNota(lida)
    assert.equal(item.productId, '')
    assert.equal(item.unitCost, '')
    assert.equal(item.descricaoNaNota, 'ALFACE CRESPA')
    assert.equal(item.unidadeNaNota, 'UN')
  })
})

describe('dados da nota', () => {
  test('preenche fornecedor, número, série, chave e total', () => {
    const dados = dadosDaNota(nota())
    assert.equal(dados.supplierName, 'Fornecedor Bom')
    assert.equal(dados.supplierDocument, '14200166000187')
    assert.equal(dados.invoiceNumber, '20')
    assert.equal(dados.invoiceAccessKey, '3'.repeat(44))
    assert.equal(dados.invoiceTotal, '55')
  })

  test('campo ausente na nota vira vazio, não a palavra nulo', () => {
    const dados = dadosDaNota(nota({ emitenteNome: null, numero: null, valorTotal: null }))
    assert.equal(dados.supplierName, '')
    assert.equal(dados.invoiceNumber, '')
    assert.equal(dados.invoiceTotal, '')
  })
})

describe('tem trabalho na tela que uma nota nova apagaria', () => {
  test('a linha vazia do formulário novo não conta como trabalho', () => {
    assert.equal(temItemPreenchido([{ productId: '', quantity: '', unitCost: '' }]), false)
  })

  test('produto escolhido conta', () => {
    assert.equal(temItemPreenchido([{ productId: 'abc', quantity: '', unitCost: '' }]), true)
  })

  test('quantidade digitada sem produto também conta', () => {
    assert.equal(temItemPreenchido([{ productId: '', quantity: '10', unitCost: '' }]), true)
  })

  test('itens vindos de uma nota anterior contam', () => {
    assert.equal(temItemPreenchido(itensDaNota(nota())), true)
  })
})

describe('resumo da leitura', () => {
  test('conta o que ficou pendente', () => {
    const resumo = resumoDaLeitura([
      { productId: 'a', quantity: '1', unitCost: '' },
      { productId: '', quantity: '1', unitCost: '' },
      { productId: '', quantity: '1', unitCost: '' },
    ])
    assert.deepEqual(resumo, { total: 3, ligados: 1, pendentes: 2 })
  })

  test('sem pendência, o texto não pede escolha nenhuma', () => {
    const texto = textoDoResumo({ total: 3, ligados: 3, pendentes: 0 })
    assert.match(texto, /Confira e confirme/)
    assert.doesNotMatch(texto, /Escolha/)
  })

  test('com um pendente, o texto fala no singular', () => {
    const texto = textoDoResumo({ total: 3, ligados: 2, pendentes: 1 })
    assert.match(texto, /Escolha o produto do item/)
  })

  test('com vários pendentes, o texto fala no plural e promete o aprendizado', () => {
    const texto = textoDoResumo({ total: 5, ligados: 2, pendentes: 3 })
    assert.match(texto, /Escolha os produtos dos 3 itens/)
    assert.match(texto, /entram sozinhos/)
  })
})

function arquivo(name: string, size: number) {
  return { name, size } as unknown as File
}

describe('juntar arquivos selecionados', () => {
  test('a seleção nova soma à anterior em vez de substituir', () => {
    const juntos = juntarArquivos([arquivo('nota.xml', 10)], [arquivo('danfe.pdf', 20)])
    assert.deepEqual(juntos.map((f) => f.name), ['nota.xml', 'danfe.pdf'])
  })

  test('o mesmo arquivo escolhido de novo não duplica', () => {
    const juntos = juntarArquivos([arquivo('nota.xml', 10)], [arquivo('nota.xml', 10)])
    assert.equal(juntos.length, 1)
  })

  test('arquivo de mesmo nome e tamanho diferente é outro arquivo', () => {
    const juntos = juntarArquivos([arquivo('nota.xml', 10)], [arquivo('nota.xml', 11)])
    assert.equal(juntos.length, 2)
  })

  test('passar do limite não some com arquivo: a lista cresce e o aviso aparece', () => {
    const juntos = juntarArquivos(
      [arquivo('nota.xml', 1)],
      [arquivo('danfe.pdf', 2), arquivo('foto1.jpg', 3), arquivo('foto2.jpg', 4)],
    )

    assert.equal(juntos.length, 4, 'um arquivo sumiu sem a pessoa saber')
    assert.match(invoiceSelectionError(juntos), new RegExp(`no máximo ${MAX_INVOICE_ATTACHMENTS}`))
  })
})
