import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { formatCnpj, formatFileSize, formatInputMask, formatPhone, formatQuantity } from '../src/lib/format.js'

describe('quantidade na tela sai em português', () => {
  test('a string do banco não é lida como milhar', () => {
    assert.equal(formatQuantity('50.000'), '50')
    assert.equal(formatQuantity('38.500'), '38,5')
  })

  test('número com casas decimais usa vírgula', () => {
    assert.equal(formatQuantity(38.5), '38,5')
    assert.equal(formatQuantity(1234.5), '1.234,5')
  })

  test('vazio e nulo não viram NaN', () => {
    assert.equal(formatQuantity(''), '0')
    assert.equal(formatQuantity(null), '0')
    assert.equal(formatQuantity(undefined), '0')
  })
})

describe('CNPJ e telefone gravados sem pontuação voltam formatados', () => {
  test('CNPJ', () => {
    assert.equal(formatCnpj('96946510000125'), '96.946.510/0001-25')
    assert.equal(formatCnpj(null), '')
  })

  test('telefone de celular e de fixo', () => {
    assert.equal(formatPhone('47997724317'), '(47) 99772-4317')
    assert.equal(formatPhone('4733334444'), '(47) 3333-4444')
    assert.equal(formatPhone(''), '')
  })
})

describe('formatFileSize', () => {
  test('MB com vírgula e arredondado para cima', () => {
    assert.equal(formatFileSize(1024 * 1024 * 2.345), '2,35 MB')
    assert.equal(formatFileSize(1024 * 1024), '1,00 MB')
  })

  test('abaixo de 1 MB fica em KB inteiro', () => {
    assert.equal(formatFileSize(900), '1 KB')
    assert.equal(formatFileSize(1024 * 300), '300 KB')
  })
})

describe('máscara de CNPJ com o modelo alfanumérico', () => {
  test('formata o exemplo oficial da Receita', () => {
    assert.equal(formatInputMask('12ABC34501DE35', 'cnpj'), '12.ABC.345/01DE-35')
    assert.equal(formatCnpj('12ABC34501DE35'), '12.ABC.345/01DE-35')
  })

  test('CNPJ só de dígitos continua igual', () => {
    assert.equal(formatCnpj('11222333000181'), '11.222.333/0001-81')
  })

  test('passa para maiúsculas e ignora pontuação digitada', () => {
    assert.equal(formatInputMask('12.abc.345/01de-35', 'cnpj'), '12.ABC.345/01DE-35')
  })

  test('letra não entra nos dois dígitos verificadores', () => {
    assert.equal(formatInputMask('12ABC34501DEAB', 'cnpj'), '12.ABC.345/01DE')
    assert.equal(formatInputMask('12ABC34501DE3', 'cnpj'), '12.ABC.345/01DE-3')
  })

  test('não passa de 14 posições', () => {
    assert.equal(formatInputMask('12ABC34501DE3599', 'cnpj'), '12.ABC.345/01DE-35')
  })
})
