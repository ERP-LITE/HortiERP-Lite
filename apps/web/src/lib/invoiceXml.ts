import type { NotaFiscalLida, NotaFiscalItemLido } from '@/types'

export interface ItemDaEntrada {
  productId: string
  quantity: string
  unitCost: string
  /** Presentes só nos itens que vieram de um XML. */
  supplierCode?: string
  descricaoNaNota?: string
  unidadeNaNota?: string
  vinculadoPor?: NotaFiscalItemLido['vinculadoPor']
}

export function itemVazio(): ItemDaEntrada {
  return { productId: '', quantity: '', unitCost: '' }
}

function texto(valor: number | null) {
  return valor === null ? '' : String(valor)
}

export function itensDaNota(nota: NotaFiscalLida): ItemDaEntrada[] {
  return nota.itens.map((item) => ({
    productId: item.productId ?? '',
    quantity: String(item.quantidade),
    unitCost: texto(item.valorUnitario),
    supplierCode: item.codigoDoFornecedor ?? undefined,
    descricaoNaNota: item.descricao,
    unidadeNaNota: item.unidade ?? undefined,
    vinculadoPor: item.vinculadoPor,
  }))
}

/**
 * A data de emissão vem da nota e a data da entrada continua sendo hoje: são coisas diferentes, e
 * lançar a mercadoria na data de emissão moveria o estoque para um dia em que ela não estava na loja.
 */
export function dadosDaNota(nota: NotaFiscalLida) {
  return {
    supplierName: nota.emitenteNome ?? '',
    supplierDocument: nota.emitenteDocumento ?? '',
    invoiceNumber: nota.numero ?? '',
    invoiceSeries: nota.serie ?? '',
    invoiceAccessKey: nota.chaveDeAcesso ?? '',
    invoiceIssuedAt: nota.emitidaEm ?? '',
    invoiceTotal: texto(nota.valorTotal),
  }
}

/**
 * Junta o que já estava selecionado com o que acabou de ser escolhido, sem repetir. Existe porque o
 * campo de arquivo devolve só a seleção atual: sem juntar, escolher o PDF depois de ler o XML jogaria
 * o XML fora sem avisar ninguém.
 *
 * **Não corta no limite de anexos de propósito.** Cortar aqui faria o arquivo que não coube sumir sem
 * mensagem nenhuma, porque o aviso da tela só aparece quando a lista passa do teto. Deixar passar é o
 * que faz o aviso aparecer e o salvamento travar até a pessoa tirar um arquivo.
 */
export function juntarArquivos(atuais: File[], novos: File[]) {
  const juntos = [...atuais]
  for (const novo of novos) {
    const repetido = juntos.some((atual) => atual.name === novo.name && atual.size === novo.size)
    if (!repetido) juntos.push(novo)
  }
  return juntos
}

/** Tem coisa preenchida que uma leitura nova apagaria? A linha vazia inicial não conta. */
export function temItemPreenchido(itens: ItemDaEntrada[]) {
  return itens.some((item) => Boolean(item.productId || item.quantity || item.unitCost))
}

export function resumoDaLeitura(itens: ItemDaEntrada[]) {
  const total = itens.length
  const pendentes = itens.filter((item) => !item.productId).length
  return { total, ligados: total - pendentes, pendentes }
}

export function textoDoResumo(resumo: { total: number; ligados: number; pendentes: number }) {
  if (resumo.pendentes === 0) {
    return resumo.total === 1
      ? 'O item da nota já foi ligado a um produto do seu cadastro. Confira e confirme.'
      : `Os ${resumo.total} itens da nota já foram ligados a produtos do seu cadastro. Confira e confirme.`
  }
  const inicio = `${resumo.ligados} de ${resumo.total} itens já vieram ligados.`
  const resto =
    resumo.pendentes === 1
      ? 'Escolha o produto do item que ficou em branco.'
      : `Escolha os produtos dos ${resumo.pendentes} itens que ficaram em branco.`
  return `${inicio} ${resto} Na próxima nota desse fornecedor eles entram sozinhos.`
}
