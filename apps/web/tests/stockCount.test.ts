import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  diferencaComSinal,
  escopoDaContagem,
  podeConferir,
  progressoDaContagem,
  textoDoProgresso,
  tomDaDiferenca,
} from '../src/lib/stockCount'
import type { StockCountStatus, StockCountTotals } from '../src/types'

const SEM_TOTAIS: StockCountTotals = {
  itemsCount: 0,
  countedCount: 0,
  pendingCount: 0,
  divergentCount: 0,
  positiveValue: 0,
  negativeValue: 0,
  netValue: 0,
}

function contagem(status: StockCountStatus, countedCount: number) {
  return { status, resumo: { ...SEM_TOTAIS, countedCount } }
}

describe('situação da contagem', () => {
  test('sem categoria o escopo é a loja toda', () => {
    assert.equal(escopoDaContagem(null), 'Loja toda')
    assert.equal(escopoDaContagem('Folhas'), 'Folhas')
  })

  test('só dá para conferir depois de contar alguma coisa', () => {
    assert.equal(podeConferir(contagem('em_andamento', 0)), false)
    assert.equal(podeConferir(contagem('em_andamento', 1)), true)
  })

  test('contagem já conferida não volta a oferecer o botão de conferir', () => {
    assert.equal(podeConferir(contagem('em_conferencia', 10)), false)
  })
})

describe('progresso da contagem', () => {
  test('contagem sem produtos não divide por zero', () => {
    assert.equal(progressoDaContagem(0, 0), 0)
  })

  test('a fração vira percentual com uma casa', () => {
    assert.equal(progressoDaContagem(1, 3), 33.3)
  })

  test('nunca passa de cem por cento', () => {
    assert.equal(progressoDaContagem(12, 10), 100)
  })

  test('o texto concorda com o número de produtos', () => {
    assert.equal(textoDoProgresso(1, 1), '1 de 1 produto contado')
    assert.equal(textoDoProgresso(1, 2), '1 de 2 produtos contados')
  })
})

describe('leitura da diferença', () => {
  test('produto não contado não ganha tom de divergência', () => {
    assert.equal(tomDaDiferenca(null), 'sem-dados')
  })

  test('sobra, falta e empate têm tons diferentes', () => {
    assert.equal(tomDaDiferenca(2), 'sobra')
    assert.equal(tomDaDiferenca(-2), 'falta')
    assert.equal(tomDaDiferenca(0), 'bate')
  })

  test('o sinal aparece na sobra e na falta, e some no empate', () => {
    assert.equal(diferencaComSinal(2.5), '+2,5')
    assert.equal(diferencaComSinal(-2.5), '-2,5')
    assert.equal(diferencaComSinal(0), '0')
  })

  test('sem diferença conhecida o texto fica vazio', () => {
    assert.equal(diferencaComSinal(null), '')
  })
})
