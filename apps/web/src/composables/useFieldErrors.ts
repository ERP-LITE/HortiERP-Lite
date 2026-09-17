import { ref, watch, type Ref } from 'vue'

/**
 * Erros por campo que somem quando a pessoa mexe naquele campo.
 *
 * `valores` é **função**, não objeto reativo: ela monta um objeto novo a cada avaliação, e é isso que
 * dá ao `watch` um "antes" de verdade. Com `deep: true` sobre um objeto mutado no lugar, o Vue
 * entrega o mesmo objeto nos dois argumentos e nada nunca parece ter mudado.
 */
export function useFieldErrors(valores: () => Record<string, unknown>) {
  const fieldErrors = ref<Record<string, string>>({})

  watch(valores, (agora, antes) => {
    for (const campo of Object.keys(fieldErrors.value)) {
      if (agora[campo] !== antes?.[campo]) delete fieldErrors.value[campo]
    }
  })

  /** Sem argumento limpa tudo; com nomes, limpa só os informados. */
  function clearFieldErrors(...campos: string[]) {
    if (campos.length === 0) {
      fieldErrors.value = {}
      return
    }
    for (const campo of campos) delete fieldErrors.value[campo]
  }

  return { fieldErrors, clearFieldErrors }
}

/**
 * O mesmo para lista de itens, comparando por índice **e** por campo: corrigir a linha 3 não pode
 * apagar o erro da linha 1. A cópia de cada linha é o que dá um "antes" ao `watch`.
 *
 * Linha adicionada ou removida embaralha os índices; as telas zeram a lista de erros nessas ações.
 */
export function useRowErrors<Campo extends string>(linhas: () => Array<Record<string, unknown>>) {
  type ErrosDaLinha = Partial<Record<Campo, string>>
  // O cast é por causa do `UnwrapRefSimple` do Vue, que achata o genérico e faz o tipo declarado
  // deixar de casar consigo mesmo.
  const rowErrors = ref<ErrosDaLinha[]>([]) as Ref<ErrosDaLinha[]>

  watch(
    () => linhas().map((linha) => ({ ...linha })),
    (agora, antes) => {
      if (!antes) return

      rowErrors.value = rowErrors.value.map((erros, indice) => {
        const depois = agora[indice]
        const anterior = antes[indice]
        if (!depois || !anterior) return erros

        const restantes: ErrosDaLinha = { ...erros }
        for (const campo of Object.keys(restantes) as Campo[]) {
          if (depois[campo] !== anterior[campo]) delete restantes[campo]
        }
        return restantes
      })
    },
  )

  return { rowErrors }
}
