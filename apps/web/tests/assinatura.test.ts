import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { textoDoContador } from '../src/lib/assinatura'

const emTeste = (diasRestantes: number | null) =>
  ({ status: 'teste' as const, diasRestantes, bloqueada: diasRestantes !== null && diasRestantes < 0 })

describe('textoDoContador', () => {
  test('conta os dias no plural e no singular', () => {
    assert.equal(textoDoContador(emTeste(15)), 'Faltam 15 dias de teste.')
    assert.equal(textoDoContador(emTeste(2)), 'Faltam 2 dias de teste.')
    assert.equal(textoDoContador(emTeste(1)), 'Falta 1 dia de teste.')
  })

  /**
   * Zero é o último dia, e não "acabou": o sistema ainda funciona, e dizer "0 dias" enquanto tudo
   * abre normalmente pareceria defeito de contagem.
   */
  test('o último dia é anunciado como último, não como zero', () => {
    assert.equal(textoDoContador(emTeste(0)), 'Hoje é o último dia do seu teste.')
    assert.doesNotMatch(textoDoContador(emTeste(0)), /0/)
  })

  test('depois do último dia o texto muda para passado', () => {
    assert.equal(textoDoContador(emTeste(-1)), 'Seu período de teste terminou.')
  })

  test('sem data de fim não inventa número', () => {
    assert.equal(textoDoContador(emTeste(null)), 'Você está no período de teste.')
  })

  test('fora do teste cada situação tem a própria frase', () => {
    const fora = (status: 'ativa' | 'atrasada' | 'cancelada') =>
      textoDoContador({ status, diasRestantes: null, bloqueada: status === 'cancelada' })

    assert.equal(fora('ativa'), 'Sua assinatura está em dia.')
    assert.equal(fora('atrasada'), 'Há uma mensalidade em aberto.')
    assert.equal(fora('cancelada'), 'Sua assinatura foi cancelada.')
  })
})
