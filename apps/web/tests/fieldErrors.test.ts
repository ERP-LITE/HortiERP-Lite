import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { nextTick, ref } from 'vue'
import { useFieldErrors, useRowErrors } from '../src/composables/useFieldErrors'

/** Formulário de duas linhas, o suficiente para provar que um campo não apaga o erro do outro. */
function formulario() {
  const email = ref('')
  const senha = ref('')
  const { fieldErrors, clearFieldErrors } = useFieldErrors(() => ({
    email: email.value,
    senha: senha.value,
  }))

  // O papel do `validate()` das telas: sempre reescreve o mapa inteiro a partir dos valores de agora.
  function validate() {
    fieldErrors.value = {}
    if (!email.value) fieldErrors.value.email = 'Informe o e-mail'
    if (!senha.value) fieldErrors.value.senha = 'Informe a senha'
    return Object.keys(fieldErrors.value).length === 0
  }

  return { email, senha, fieldErrors, clearFieldErrors, validate }
}

describe('useFieldErrors', () => {
  test('digitar no campo apaga o erro dele', async () => {
    const { email, fieldErrors, validate } = formulario()

    validate()
    assert.equal(fieldErrors.value.email, 'Informe o e-mail')

    email.value = 'a'
    await nextTick()

    assert.equal(fieldErrors.value.email, undefined)
  })

  test('corrigir um campo não apaga o erro do outro', async () => {
    const { email, fieldErrors, validate } = formulario()

    validate()
    email.value = 'alguem@exemplo.com'
    await nextTick()

    assert.equal(fieldErrors.value.email, undefined)
    assert.equal(fieldErrors.value.senha, 'Informe a senha', 'a senha continua pendente')
  })

  /**
   * O caso que derruba a solução ingênua de esconder o erro assim que a pessoa digita: apagar de
   * novo e reenviar produz a **mesma** frase de antes. Se quem reexibe fosse o observador, ele não
   * veria mudança nenhuma e o vermelho não voltaria, deixando o botão com cara de quebrado.
   */
  test('apagar o que foi digitado e enviar de novo mostra o mesmo erro outra vez', async () => {
    const { email, fieldErrors, validate } = formulario()

    validate()
    email.value = 'a'
    await nextTick()
    assert.equal(fieldErrors.value.email, undefined)

    email.value = ''
    await nextTick()

    validate()
    assert.equal(fieldErrors.value.email, 'Informe o e-mail')
  })

  test('mexer num campo sem erro não quebra nada', async () => {
    const { email, senha, fieldErrors } = formulario()

    fieldErrors.value = { email: 'Informe o e-mail' }
    senha.value = 'qualquer'
    await nextTick()

    assert.equal(fieldErrors.value.email, 'Informe o e-mail')
  })

  test('clearFieldErrors limpa tudo, ou só os campos informados', () => {
    const { fieldErrors, clearFieldErrors } = formulario()

    fieldErrors.value = { email: 'a', senha: 'b' }
    clearFieldErrors('email')
    assert.deepEqual(fieldErrors.value, { senha: 'b' })

    clearFieldErrors()
    assert.deepEqual(fieldErrors.value, {})
  })
})

/** Formulário com lista de itens, no formato da entrada de mercadoria e do ajuste em lote. */
function listaDeItens() {
  const items = ref([
    { productId: '', quantity: '' },
    { productId: '', quantity: '' },
  ])
  const { rowErrors } = useRowErrors<'productId' | 'quantity'>(() => items.value)

  function validate() {
    rowErrors.value = items.value.map((item) => {
      const erros: { productId?: string; quantity?: string } = {}
      if (!item.productId) erros.productId = 'Selecione o produto'
      if (!item.quantity) erros.quantity = 'Informe a quantidade'
      return erros
    })
    return rowErrors.value.every((erros) => Object.keys(erros).length === 0)
  }

  return { items, rowErrors, validate }
}

describe('useRowErrors', () => {
  test('escolher o produto de uma linha apaga o erro daquela célula', async () => {
    const { items, rowErrors, validate } = listaDeItens()

    validate()
    assert.equal(rowErrors.value[0].productId, 'Selecione o produto')

    items.value[0].productId = 'uuid-do-produto'
    await nextTick()

    assert.equal(rowErrors.value[0].productId, undefined)
    assert.equal(rowErrors.value[0].quantity, 'Informe a quantidade', 'a quantidade da mesma linha continua')
  })

  test('corrigir a linha 1 não apaga o erro da linha 2', async () => {
    const { items, rowErrors, validate } = listaDeItens()

    validate()
    items.value[0].productId = 'uuid-do-produto'
    await nextTick()

    assert.equal(rowErrors.value[0].productId, undefined)
    assert.equal(rowErrors.value[1].productId, 'Selecione o produto', 'a outra linha não foi tocada')
  })

  test('limpar o campo e enviar de novo mostra o mesmo erro outra vez', async () => {
    const { items, rowErrors, validate } = listaDeItens()

    validate()
    items.value[0].quantity = '10'
    await nextTick()
    assert.equal(rowErrors.value[0].quantity, undefined)

    items.value[0].quantity = ''
    await nextTick()
    validate()

    assert.equal(rowErrors.value[0].quantity, 'Informe a quantidade')
  })
})
