import { computed, ref, type Ref } from 'vue'
import { toastError, toastSuccess } from '@/lib/alerts'
import { resolveFormError } from '@/services/api'

export interface CrudModalOptions<TForm, TEntity, TCreated> {
  /** Formulário em branco. Função, não objeto: valores como a data de hoje mudam a cada abertura. */
  emptyForm: () => TForm
  toForm: (entity: TEntity) => TForm
  create: (form: TForm) => Promise<TCreated>
  update: (id: string, form: TForm) => Promise<unknown>
  reload: () => void | Promise<void>
  createdMessage: string | ((created: TCreated) => string)
  updatedMessage: string
  saveErrorMessage: string | ((editing: boolean) => string)
  validate?: () => boolean
  /** Estado extra da tela a zerar ao abrir (confirmação de senha, aba ativa, registro em edição). */
  onOpen?: (entity: TEntity | null) => void
  /** Roda depois de preencher os erros de campo devolvidos pela API. */
  onSaveError?: () => void
}

export function useCrudModal<TForm, TEntity extends { id: string }, TCreated = unknown>(
  options: CrudModalOptions<TForm, TEntity, TCreated>,
) {
  const modalOpen = ref(false)
  const editingId = ref<string | null>(null)
  const saving = ref(false)
  const form = ref(options.emptyForm()) as Ref<TForm>
  const fieldErrors = ref<Record<string, string>>({})
  const isEditing = computed(() => editingId.value !== null)

  function clearFieldErrors(...fields: string[]) {
    if (fields.length === 0) {
      fieldErrors.value = {}
      return
    }
    for (const field of fields) delete fieldErrors.value[field]
  }

  function openModal(entity: TEntity | null) {
    editingId.value = entity?.id ?? null
    form.value = entity ? options.toForm(entity) : options.emptyForm()
    fieldErrors.value = {}
    options.onOpen?.(entity)
    modalOpen.value = true
  }

  function openCreateModal() {
    openModal(null)
  }

  function openEditModal(entity: TEntity) {
    openModal(entity)
  }

  function resolveMessage<T>(message: string | ((value: T) => string), value: T) {
    return typeof message === 'function' ? message(value) : message
  }

  async function handleSubmit() {
    if (options.validate && !options.validate()) return

    saving.value = true
    try {
      if (editingId.value) {
        await options.update(editingId.value, form.value)
        toastSuccess(options.updatedMessage)
      } else {
        const created = await options.create(form.value)
        toastSuccess(resolveMessage(options.createdMessage, created))
      }
      modalOpen.value = false
      await options.reload()
    } catch (error) {
      const result = resolveFormError(error, resolveMessage(options.saveErrorMessage, isEditing.value))
      fieldErrors.value = result.fieldErrors
      options.onSaveError?.()
      if (result.message) toastError(result.message)
    } finally {
      saving.value = false
    }
  }

  return {
    modalOpen,
    editingId,
    saving,
    form,
    fieldErrors,
    isEditing,
    clearFieldErrors,
    openModal,
    openCreateModal,
    openEditModal,
    handleSubmit,
  }
}
