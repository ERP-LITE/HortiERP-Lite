import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  CAMPOS_DA_ABA_ENDERECO,
  CAMPOS_DA_ABA_GERAL,
  primeiraAbaComErro,
} from '../src/lib/companyForm'

const ABAS = [
  { id: 'plano' as const, campos: ['planId'] },
  { id: 'company' as const, campos: CAMPOS_DA_ABA_GERAL },
  { id: 'address' as const, campos: CAMPOS_DA_ABA_ENDERECO },
]

describe('primeiraAbaComErro', () => {
  test('leva para a aba do campo que reclamou', () => {
    assert.equal(primeiraAbaComErro(['document'], ABAS), 'company')
    assert.equal(primeiraAbaComErro(['postalCode'], ABAS), 'address')
    assert.equal(primeiraAbaComErro(['planId'], ABAS), 'plano')
  })

  /**
   * Com erro em duas abas, ir para a última faria a pessoa corrigir o CEP, enviar de novo e ser
   * jogada para trás por causa do CNPJ que já estava errado desde o começo.
   */
  test('com erro em mais de uma aba, leva para a primeira delas', () => {
    assert.equal(primeiraAbaComErro(['postalCode', 'document'], ABAS), 'company')
    assert.equal(primeiraAbaComErro(['document', 'planId'], ABAS), 'plano')
  })

  test('devolve null quando o erro não é de nenhuma aba listada', () => {
    assert.equal(primeiraAbaComErro(['adminEmail'], ABAS), null)
    assert.equal(primeiraAbaComErro(['privacyAccepted'], ABAS), null)
    assert.equal(primeiraAbaComErro([], ABAS), null)
  })
})
