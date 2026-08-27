import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { AppError } from '../src/shared/errors/AppError.js'
import { criarLoginThrottle } from '../src/shared/security/loginThrottle.js'

const CONTA = 'alvo@test.local'

/** Relógio controlado: o freio trabalha com minutos, e teste não pode esperar minuto nenhum. */
function relogio(inicio = 1_700_000_000_000) {
  let agora = inicio
  return { ler: () => agora, avancar: (ms: number) => (agora += ms) }
}

function errar(throttle: ReturnType<typeof criarLoginThrottle>, vezes: number) {
  for (let i = 0; i < vezes; i += 1) throttle.registerLoginFailure(CONTA)
}

function bloqueio(throttle: ReturnType<typeof criarLoginThrottle>) {
  try {
    throttle.assertLoginAllowed(CONTA)
    return null
  } catch (error) {
    assert.ok(error instanceof AppError)
    return error
  }
}

describe('freio de tentativas de login por conta', () => {
  test('as quatro primeiras falhas não bloqueiam', () => {
    const tempo = relogio()
    const throttle = criarLoginThrottle(tempo.ler)

    errar(throttle, 4)

    assert.equal(bloqueio(throttle), null)
  })

  test('a quinta falha bloqueia por um minuto', () => {
    const tempo = relogio()
    const throttle = criarLoginThrottle(tempo.ler)

    errar(throttle, 5)

    const erro = bloqueio(throttle)
    assert.equal(erro?.statusCode, 429)
    assert.match(erro?.message ?? '', /Tente novamente em 1 minuto/)

    tempo.avancar(60_000)
    assert.equal(bloqueio(throttle), null)
  })

  test('insistir depois do bloqueio sobe para os degraus seguintes', () => {
    const tempo = relogio()
    const throttle = criarLoginThrottle(tempo.ler)

    errar(throttle, 10)
    assert.match(bloqueio(throttle)?.message ?? '', /5 minutos/)

    errar(throttle, 5)
    assert.match(bloqueio(throttle)?.message ?? '', /15 minutos/)
  })

  test('a mensagem não diz se a conta existe', () => {
    const tempo = relogio()
    const throttle = criarLoginThrottle(tempo.ler)

    errar(throttle, 5)

    const mensagem = bloqueio(throttle)?.message ?? ''
    assert.doesNotMatch(mensagem, /conta|usuário|e-mail|bloqueada/i)
  })

  test('login certo limpa a contagem', () => {
    const tempo = relogio()
    const throttle = criarLoginThrottle(tempo.ler)

    errar(throttle, 4)
    throttle.clearLoginFailures(CONTA)
    errar(throttle, 4)

    assert.equal(bloqueio(throttle), null)
  })

  test('falha antiga não conta: a janela é de 15 minutos', () => {
    const tempo = relogio()
    const throttle = criarLoginThrottle(tempo.ler)

    errar(throttle, 4)
    tempo.avancar(15 * 60_000 + 1)
    errar(throttle, 4)

    assert.equal(bloqueio(throttle), null)
  })

  test('o bloqueio é por conta, não geral', () => {
    const tempo = relogio()
    const throttle = criarLoginThrottle(tempo.ler)

    errar(throttle, 5)

    throttle.assertLoginAllowed('outra-pessoa@test.local')
  })
})
