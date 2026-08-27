import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { deletionMessages } from '../src/lib/deletionMessages'

describe('mensagens de exclusão', () => {
  test('registro masculino flexiona artigo e particípio', () => {
    const m = deletionMessages({ singular: 'produto', plural: 'produtos' })

    assert.equal(m.confirmTitle('Banana prata'), 'Excluir o produto "Banana prata"?')
    assert.equal(m.success, 'Produto excluído com sucesso')
    assert.equal(m.error, 'Não foi possível excluir o produto')
    assert.equal(m.bulkConfirmTitle(3), 'Excluir 3 produtos selecionados?')
    assert.equal(m.bulkSuccess(3), '3 produtos excluídos com sucesso')
    assert.equal(m.bulkError, 'Não foi possível excluir os produtos selecionados')
  })

  test('registro feminino flexiona artigo e particípio', () => {
    const m = deletionMessages({ singular: 'categoria', plural: 'categorias', genero: 'f' })

    assert.equal(m.confirmTitle('Frutas'), 'Excluir a categoria "Frutas"?')
    assert.equal(m.success, 'Categoria excluída com sucesso')
    assert.equal(m.error, 'Não foi possível excluir a categoria')
    assert.equal(m.bulkConfirmTitle(4), 'Excluir 4 categorias selecionadas?')
    assert.equal(m.bulkSuccess(4), '4 categorias excluídas com sucesso')
    assert.equal(m.bulkError, 'Não foi possível excluir as categorias selecionadas')
  })

  // O singular precisa aparecer inteiro na contagem 1: "1 unidades excluídas" é o erro clássico aqui.
  test('contagem 1 usa o singular nos dois textos em massa', () => {
    const feminino = deletionMessages({ singular: 'unidade', plural: 'unidades', genero: 'f' })
    const masculino = deletionMessages({ singular: 'usuário', plural: 'usuários' })

    assert.equal(feminino.bulkConfirmTitle(1), 'Excluir 1 unidade selecionada?')
    assert.equal(feminino.bulkSuccess(1), '1 unidade excluída com sucesso')
    assert.equal(masculino.bulkConfirmTitle(1), 'Excluir 1 usuário selecionado?')
    assert.equal(masculino.bulkSuccess(1), '1 usuário excluído com sucesso')
  })

  test('nome composto capitaliza só a primeira palavra', () => {
    const m = deletionMessages({ singular: 'super administrador', plural: 'super administradores' })

    assert.equal(m.confirmTitle('Felipe'), 'Excluir o super administrador "Felipe"?')
    assert.equal(m.success, 'Super administrador excluído com sucesso')
    assert.equal(m.error, 'Não foi possível excluir o super administrador')
  })
})
