import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { marginTone, shouldSuggestPrice } from '../src/lib/margin'

describe('cor da margem', () => {
  test('sem preço de venda não classifica', () => {
    assert.equal(marginTone(null, 40), 'sem-dados')
  })

  test('vender abaixo do custo é prejuízo, mesmo sem margem alvo', () => {
    assert.equal(marginTone(-5, null), 'prejuizo')
  })

  test('abaixo do alvo avisa', () => {
    assert.equal(marginTone(30, 40), 'abaixo')
  })

  test('encostar no alvo já conta como alcançado', () => {
    assert.equal(marginTone(40, 40), 'ok')
  })

  test('sem alvo definido, margem positiva não vira aviso', () => {
    assert.equal(marginTone(5, null), 'ok')
  })
})

describe('quando sugerir preço', () => {
  test('sem preço sugerido não há o que mostrar', () => {
    assert.equal(shouldSuggestPrice('10.00', null), false)
  })

  test('produto sem preço de venda sempre recebe sugestão', () => {
    assert.equal(shouldSuggestPrice(null, 16.67), true)
  })

  test('diferença de um centavo é arredondamento, não recomendação', () => {
    assert.equal(shouldSuggestPrice('16.67', 16.67), false)
    assert.equal(shouldSuggestPrice('16.68', 16.67), false)
  })

  test('diferença real vira sugestão', () => {
    assert.equal(shouldSuggestPrice('14.00', 16.67), true)
  })
})
