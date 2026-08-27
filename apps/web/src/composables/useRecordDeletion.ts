import { ref, type Ref } from 'vue'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import { deletionMessages, type DeletionSubject } from '@/lib/deletionMessages'
import { getApiErrorMessage } from '@/services/api'

const TEXTO_EXCLUSAO_INDIVIDUAL = 'Essa ação não pode ser desfeita.'
const TEXTO_EXCLUSAO_EM_MASSA = 'Os registros serão excluídos logicamente e deixarão de aparecer no sistema.'

export interface RecordDeletionOptions<TEntity extends { id: string; name: string }> extends DeletionSubject {
  remove: (id: string) => Promise<unknown>
  reload: () => void | Promise<void>
  removeMany?: (ids: string[]) => Promise<{ deleted: number }>
  selectedIds?: Ref<string[]>
  confirmText?: string
  bulkConfirmText?: string
  nameOf?: (entity: TEntity) => string
}
    
export function useRecordDeletion<TEntity extends { id: string; name: string }>(
  options: RecordDeletionOptions<TEntity>,
) {
  const mensagens = deletionMessages(options)
  const deletingSelected = ref(false)

  async function handleDelete(entity: TEntity) {
    const nome = options.nameOf ? options.nameOf(entity) : entity.name
    const confirmed = await confirmDelete({
      title: mensagens.confirmTitle(nome),
      text: options.confirmText ?? TEXTO_EXCLUSAO_INDIVIDUAL,
    })
    if (!confirmed) return

    try {
      await options.remove(entity.id)
      await options.reload()
      toastSuccess(mensagens.success)
    } catch (error) {
      toastError(getApiErrorMessage(error, mensagens.error))
    }
  }

  async function handleBulkDelete() {
    const { removeMany, selectedIds } = options
    if (!removeMany || !selectedIds) return

    const confirmed = await confirmDelete({
      title: mensagens.bulkConfirmTitle(selectedIds.value.length),
      text: options.bulkConfirmText ?? TEXTO_EXCLUSAO_EM_MASSA,
    })
    if (!confirmed) return

    deletingSelected.value = true
    try {
      const { deleted } = await removeMany(selectedIds.value)
      await options.reload()
      toastSuccess(mensagens.bulkSuccess(deleted))
    } catch (error) {
      toastError(getApiErrorMessage(error, mensagens.bulkError))
    } finally {
      deletingSelected.value = false
    }
  }

  return { deletingSelected, handleDelete, handleBulkDelete }
}
