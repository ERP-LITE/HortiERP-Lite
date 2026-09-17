import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { shrinkageBarWidth, shrinkageStatus } from '../src/lib/shrinkage'

function quebra(percent: number | null) {
  return { lossValue: 0, entriesValue: 0, percent, targetPercent: 5 }
}

describe('situação da quebra', () => {
  test('sem entrada no período não classifica', () => {
    assert.equal(shrinkageStatus(quebra(null)), 'sem-dados')
  })

  test('abaixo de 80% da meta está dentro', () => {
    assert.equal(shrinkageStatus(quebra(3.9)), 'dentro')
  })

  test('a partir de 80% da meta já avisa', () => {
    assert.equal(shrinkageStatus(quebra(4)), 'atencao')
  })

  test('encostar na meta ainda não é estouro', () => {
    assert.equal(shrinkageStatus(quebra(5)), 'atencao')
  })

  test('passar da meta é estouro', () => {
    assert.equal(shrinkageStatus(quebra(5.01)), 'acima')
  })
})

describe('largura da barra', () => {
  test('a meta fica em dois terços da barra', () => {
    assert.equal(shrinkageBarWidth(quebra(5)), 66.7)
  })

  test('quebra zerada não desenha barra', () => {
    assert.equal(shrinkageBarWidth(quebra(0)), 0)
  })

  test('quebra muito acima da meta para na largura total', () => {
    assert.equal(shrinkageBarWidth(quebra(80)), 100)
  })

  test('sem percentual não desenha barra', () => {
    assert.equal(shrinkageBarWidth(quebra(null)), 0)
  })
})
