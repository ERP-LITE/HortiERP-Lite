import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { useFilterModal } from '../src/composables/useFilterModal'

function criarPadrao() {
  return { situacao: 'todos', periodo: { preset: 'todos', from: '', to: '' } }
}

describe('useFilterModal', () => {
  test('mexer no rascunho não altera o filtro já aplicado', () => {
    const { filters, draftFilters, openFilterModal } = useFilterModal(criarPadrao, () => {})

    openFilterModal()
    draftFilters.value.situacao = 'true'
    draftFilters.value.periodo.from = '2026-08-01'

    assert.equal(filters.value.situacao, 'todos')
    assert.equal(filters.value.periodo.from, '')
  })

  test('aplicar copia o rascunho, fecha e avisa a tela', () => {
    let recarregou = 0
    const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters } = useFilterModal(
      criarPadrao,
      () => {
        recarregou += 1
      },
    )

    openFilterModal()
    draftFilters.value.periodo.from = '2026-08-01'
    applyFilters()

    assert.equal(filters.value.periodo.from, '2026-08-01')
    assert.equal(filterModalOpen.value, false)
    assert.equal(recarregou, 1)

    draftFilters.value.periodo.from = '2026-01-01'
    assert.equal(filters.value.periodo.from, '2026-08-01')
  })

  test('limpar volta ao padrão nos dois lados', () => {
    const { filters, draftFilters, openFilterModal, applyFilters, clearFilters } = useFilterModal(criarPadrao, () => {})

    openFilterModal()
    draftFilters.value.situacao = 'false'
    applyFilters()
    clearFilters()

    assert.equal(filters.value.situacao, 'todos')
    assert.equal(draftFilters.value.situacao, 'todos')
  })
})
