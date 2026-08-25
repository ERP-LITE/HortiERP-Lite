import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { activityDetailsText, describeActivityDetails } from '../src/lib/activityDetails.js'

describe('informações adicionais do log de atividade viram texto legível', () => {
  test('sem detalhes não gera nenhuma linha', () => {
    assert.deepEqual(describeActivityDetails(null), [])
    assert.deepEqual(describeActivityDetails(undefined), [])
    assert.equal(activityDetailsText(null), '')
  })

  test('perfil e motivo saem traduzidos', () => {
    assert.deepEqual(describeActivityDetails({ perfil: 'gerente' }), [
      { label: 'Perfil de acesso', value: 'Gerente' },
    ])
    assert.deepEqual(describeActivityDetails({ motivo: 'roubo_furto' }), [
      { label: 'Motivo', value: 'Roubo/Furto' },
    ])
  })

  test('motivo escrito à mão no cancelamento é preservado', () => {
    assert.deepEqual(describeActivityDetails({ motivo: 'Lançamento em duplicidade' }), [
      { label: 'Motivo', value: 'Lançamento em duplicidade' },
    ])
  })

  test('sim/não em vez de true/false', () => {
    assert.deepEqual(describeActivityDetails({ senhaAlterada: false }), [
      { label: 'Senha alterada', value: 'Não' },
    ])
  })

  test('quantidade do banco não é lida como milhar', () => {
    assert.deepEqual(describeActivityDetails({ quantidadeEstornada: '50.000' }), [
      { label: 'Quantidade devolvida ao estoque', value: '50' },
    ])
  })

  test('lista vazia e lista com itens', () => {
    assert.deepEqual(describeActivityDetails({ categoriasCriadas: [] }), [
      { label: 'Categorias criadas', value: 'Nenhuma' },
    ])
    assert.deepEqual(describeActivityDetails({ unidadesCriadas: ['Caixa', 'Bandeja'] }), [
      { label: 'Unidades criadas', value: 'Caixa, Bandeja' },
    ])
  })

  test('chave sem tradução aparece legível em vez de camelCase', () => {
    assert.deepEqual(describeActivityDetails({ campoNovoQualquer: 'x' }), [
      { label: 'Campo novo qualquer', value: 'x' },
    ])
  })

  test('texto da planilha junta as informações', () => {
    assert.equal(
      activityDetailsText({ produtos: 12, comEstoqueInicial: 4 }),
      'Produtos importados: 12 · Com estoque inicial: 4',
    )
  })
})
