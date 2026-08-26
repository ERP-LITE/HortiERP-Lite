import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  LIMITES_NUMERO as LIMITES_NUMERO_API,
  LIMITES_TEXTO as LIMITES_TEXTO_API,
  SENHA_MAX_BYTES,
} from '../../api/src/shared/schemas/limits.js'
import { LIMITES_NUMERO, LIMITES_TEXTO } from '../src/lib/limits.js'

describe('limites do frontend espelham os da API', () => {
  test('todo limite de texto do espelho tem o mesmo valor na API', () => {
    for (const [campo, valor] of Object.entries(LIMITES_TEXTO)) {
      if (campo === 'senha') continue
      assert.equal(valor, LIMITES_TEXTO_API[campo as keyof typeof LIMITES_TEXTO_API], `LIMITES_TEXTO.${campo}`)
    }
  })

  test('todo limite numérico do espelho tem o mesmo valor na API', () => {
    for (const [campo, valor] of Object.entries(LIMITES_NUMERO)) {
      assert.equal(valor, LIMITES_NUMERO_API[campo as keyof typeof LIMITES_NUMERO_API], `LIMITES_NUMERO.${campo}`)
    }
  })

  test('nenhum limite da API ficou de fora do espelho', () => {
    const faltando = Object.keys(LIMITES_TEXTO_API).filter((campo) => !(campo in LIMITES_TEXTO))
    assert.deepEqual(faltando, [])
  })

  test('o teto de senha da tela é o mesmo teto de bytes do bcrypt', () => {
    assert.equal(LIMITES_TEXTO.senha, SENHA_MAX_BYTES)
  })

  test('quantidade e dinheiro cabem na precisão das colunas', () => {
    const digitos = (valor: number, escala: number) => String(Math.trunc(valor)).length + escala
    assert.ok(digitos(LIMITES_NUMERO.quantidade, 3) <= 12)
    assert.ok(digitos(LIMITES_NUMERO.valorUnitario, 2) <= 12)
    assert.ok(digitos(LIMITES_NUMERO.valorNota, 2) <= 12)
    assert.ok(digitos(LIMITES_NUMERO.mensalidade, 2) <= 12)
  })
})
