import { artigo, capitalizar, flexionar, type Genero } from './grammar'

export interface DeletionSubject {
  singular: string
  plural: string
  genero?: Genero
}

/**
 * Textos de exclusão de um registro, flexionados a partir do nome dele. Ficam fora do composable
 * para poderem ser conferidos por teste sem passar pelo SweetAlert.
 */
export function deletionMessages({ singular, plural, genero = 'm' }: DeletionSubject) {
  return {
    confirmTitle: (nome: string) => `Excluir ${artigo(genero)} ${singular} "${nome}"?`,
    success: `${capitalizar(singular)} ${flexionar('excluído', genero)} com sucesso`,
    error: `Não foi possível excluir ${artigo(genero)} ${singular}`,
    bulkConfirmTitle: (quantidade: number) =>
      `Excluir ${quantidade} ${quantidade === 1 ? singular : plural} ${flexionar('selecionado', genero, quantidade !== 1)}?`,
    bulkSuccess: (quantidade: number) =>
      `${quantidade} ${quantidade === 1 ? singular : plural} ${flexionar('excluído', genero, quantidade !== 1)} com sucesso`,
    bulkError: `Não foi possível excluir ${artigo(genero, true)} ${plural} ${flexionar('selecionado', genero, true)}`,
  }
}
