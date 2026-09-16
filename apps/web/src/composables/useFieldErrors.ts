import { ref, watch, type Ref } from 'vue'

/**
 * Erros por campo que somem sozinhos quando a pessoa mexe naquele campo. Um erro que continua
 * vermelho enquanto a pessoa corrige ensina a ignorar o vermelho.
 *
 * Só apaga o erro **do campo que mudou**: corrigir o e-mail não pode dar a impressão de que a senha
 * também foi resolvida.
 *
 * `valores` é uma função, e não um objeto reativo, por dois motivos. Ela monta um objeto novo a cada
 * avaliação, e é isso que dá ao `watch` um "antes" de verdade para comparar: com `deep: true` sobre
 * um objeto mutado no lugar, o Vue entrega o mesmo objeto nos dois argumentos e nada nunca parece
 * ter mudado. E ela deixa a tela juntar campos que moram em `ref` separados, como as de login, com
 * os que moram num formulário só.
 *
 * O caso que o desenho precisa acertar é o reenvio: apagar o campo, enviar de novo e receber a mesma
 * frase de erro. Como quem reexibe é a validação, e não este `watch`, o vermelho volta mesmo sendo a
 * mensagem idêntica à anterior.
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
 * A mesma ideia para formulário com lista de itens, onde o erro é de uma célula e não do formulário:
 * a entrada de mercadoria e o ajuste de estoque em lote têm um produto e uma quantidade por linha.
 *
 * Corrigir a linha 3 não pode apagar o erro da linha 1, então a comparação é por índice **e** por
 * campo. O instantâneo de cada linha é montado aqui dentro para o chamador passar só
 * `() => items.value`: sem a cópia, o Vue entrega o mesmo array nos dois argumentos e nada nunca
 * parece ter mudado.
 *
 * Linha adicionada ou removida embaralha os índices, e por isso as telas zeram a lista inteira de
 * erros nessas duas ações. Isto aqui não tenta adivinhar o remanejamento.
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
