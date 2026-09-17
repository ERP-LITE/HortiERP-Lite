/** Quantidade guarda 3 casas e dinheiro 2; sem o arredondamento, 0,1 + 0,2 vira divergência falsa. */
const CASAS_DE_QUANTIDADE = 1000
const CASAS_DE_DINHEIRO = 100

export function arredondarQuantidade(valor: number) {
  return Math.round(valor * CASAS_DE_QUANTIDADE) / CASAS_DE_QUANTIDADE
}

function arredondarDinheiro(valor: number) {
  return Math.round(valor * CASAS_DE_DINHEIRO) / CASAS_DE_DINHEIRO
}

export interface LinhaDeContagem {
  countedQuantity: string | null
  previousQuantity: string | null
  unitCost: string | null
}

interface Divergencia {
  /** Contado menos o que o sistema tinha. Nulo enquanto o produto não foi contado. */
  difference: number | null
  /** A diferença avaliada pelo custo do produto. Nulo também quando não há custo cadastrado. */
  differenceValue: number | null
}

export function divergenciaDaLinha(linha: LinhaDeContagem): Divergencia {
  if (linha.countedQuantity === null || linha.previousQuantity === null) {
    return { difference: null, differenceValue: null }
  }

  const difference = arredondarQuantidade(Number(linha.countedQuantity) - Number(linha.previousQuantity))
  if (linha.unitCost === null) return { difference, differenceValue: null }

  return { difference, differenceValue: arredondarDinheiro(difference * Number(linha.unitCost)) }
}

interface ResumoDaContagem {
  itemsCount: number
  countedCount: number
  pendingCount: number
  divergentCount: number
  /** Sobra: contou mais do que o sistema tinha. */
  positiveValue: number
  /** Falta, já em número positivo, para a tela não precisar inverter o sinal. */
  negativeValue: number
  /** Sobra menos falta. Negativo significa mercadoria que sumiu sem ninguém registrar. */
  netValue: number
}

export function resumoDaContagem(linhas: LinhaDeContagem[]): ResumoDaContagem {
  let countedCount = 0
  let divergentCount = 0
  let positiveValue = 0
  let negativeValue = 0

  for (const linha of linhas) {
    if (linha.countedQuantity === null) continue
    countedCount += 1

    const { difference, differenceValue } = divergenciaDaLinha(linha)
    if (difference === null || difference === 0) continue
    divergentCount += 1

    if (differenceValue === null) continue
    if (differenceValue > 0) positiveValue += differenceValue
    else negativeValue -= differenceValue
  }

  positiveValue = arredondarDinheiro(positiveValue)
  negativeValue = arredondarDinheiro(negativeValue)

  return {
    itemsCount: linhas.length,
    countedCount,
    pendingCount: linhas.length - countedCount,
    divergentCount,
    positiveValue,
    negativeValue,
    netValue: arredondarDinheiro(positiveValue - negativeValue),
  }
}
