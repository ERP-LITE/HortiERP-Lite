import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { criarTreguaDeSessao } from '../src/lib/sessionRedirect'

function relogio(inicio = 1_700_000_000_000) {
  let agora = inicio
  return { ler: () => agora, avancar: (ms: number) => (agora += ms) }
}

describe('trégua no redirecionamento para o login', () => {
  test('sem troca de senha em andamento, o 401 continua mandando para o login', () => {
    const tregua = criarTreguaDeSessao(relogio().ler)

    assert.equal(tregua.ativa(), false)
  })

  test('cobre a janela entre a senha gravada e o cookie novo chegar', () => {
    const tempo = relogio()
    const tregua = criarTreguaDeSessao(tempo.ler)

    tregua.iniciar()
    tempo.avancar(800)

    assert.equal(tregua.ativa(), true)
  })

  test('a trégua expira: 401 depois dela volta a mandar para o login', () => {
    const tempo = relogio()
    const tregua = criarTreguaDeSessao(tempo.ler)

    tregua.iniciar()
    tempo.avancar(5001)

    assert.equal(tregua.ativa(), false)
  })

  // A troca chama `iniciar` de novo no fim: numa conexão ruim a resposta pode voltar depois de a
  // primeira trégua ter vencido, e é justo aí que o cookie novo acaba de chegar.
  test('resposta demorada renova a trégua a partir do fim da chamada', () => {
    const tempo = relogio()
    const tregua = criarTreguaDeSessao(tempo.ler)

    tregua.iniciar()
    tempo.avancar(4000)
    tregua.iniciar()
    tempo.avancar(4000)

    assert.equal(tregua.ativa(), true)
  })
})
