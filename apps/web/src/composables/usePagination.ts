import { computed, ref, watch, type Ref } from 'vue'

const PAGE_SIZE_STORAGE_KEY = 'hortierp_page_size'
const DEFAULT_PAGE_SIZE = 15

export const PAGE_SIZE_OPTIONS = [15, 30, 50, 100]

function getStoredPageSize(): number {
  const stored = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY))
  return PAGE_SIZE_OPTIONS.includes(stored) ? stored : DEFAULT_PAGE_SIZE
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function usePagination() {
  const page = ref(1)
  const pageSize = ref(getStoredPageSize())
  const total = ref(0)
  const totalPages = ref(1)

  watch(pageSize, (value) => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(value))
    page.value = 1
  })

  function applyMeta(meta: PaginationMeta) {
    total.value = meta.total
    totalPages.value = meta.totalPages
  }

  function reload(load: () => void | Promise<void>) {
    if (page.value !== 1) page.value = 1
    else void load()
  }

  function watchSearch(search: Ref<string>, load: () => void) {
    watch(search, () => reload(load))
    watch([page, pageSize], load)
  }

  const paginationProps = computed(() => ({
    page: page.value,
    pageSize: pageSize.value,
    total: total.value,
    totalPages: totalPages.value,
    'onUpdate:page': (value: number) => {
      page.value = value
    },
    'onUpdate:pageSize': (value: number) => {
      pageSize.value = value
    },
  }))

  return { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps }
}
