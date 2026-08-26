import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { MAX_INVOICE_FILE_SIZE, invoiceKeyError, invoiceSelectionError } from '../src/lib/invoiceAttachments'

function arquivo(name: string, size: number) {
  return { name, size } as File
}

describe('seleção de anexos da nota', () => {
  test('nada selecionado não é erro', () => {
    assert.equal(invoiceSelectionError([]), '')
  })

  test('um byte acima do limite não pode aparecer como se estivesse no limite', () => {
    const erro = invoiceSelectionError([arquivo('nota.pdf', MAX_INVOICE_FILE_SIZE + 1)])
    assert.equal(erro, 'nota.pdf tem 10,01 MB e o limite por arquivo é 10 MB')
  })

  test('arquivo grande de verdade mostra o tamanho real', () => {
    const erro = invoiceSelectionError([arquivo('nota.pdf', 12.5 * 1024 * 1024)])
    assert.equal(erro, 'nota.pdf tem 12,50 MB e o limite por arquivo é 10 MB')
  })

  test('exatamente no limite passa', () => {
    assert.equal(invoiceSelectionError([arquivo('nota.pdf', MAX_INVOICE_FILE_SIZE)]), '')
  })

  test('conta os anexos que a entrada já tem', () => {
    const dois = [arquivo('a.pdf', 1024), arquivo('b.pdf', 1024)]
    assert.equal(invoiceSelectionError(dois, 0), '')
    assert.match(invoiceSelectionError(dois, 2), /no máximo 3 anexos/)
  })
})

describe('chave de acesso da NF-e', () => {
  test('campo vazio não é erro: a nota fiscal é opcional', () => {
    assert.equal(invoiceKeyError(''), '')
  })

  test('44 dígitos passam', () => {
    assert.equal(invoiceKeyError('1'.repeat(44)), '')
  })

  test('chave incompleta é recusada antes de ir ao servidor', () => {
    assert.equal(invoiceKeyError('123'), 'A chave da NF-e deve ter 44 dígitos')
  })

  test('letra no meio dos 44 caracteres é recusada', () => {
    assert.equal(invoiceKeyError(`${'1'.repeat(43)}A`), 'A chave da NF-e deve ter 44 dígitos')
  })
})
