import { ref, watch } from 'vue'

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

/**
 * pageSize is persisted in localStorage so it acts as a single global
 * default shared by every paginated table, while each table keeps its
 * own page/total state independently.
 */
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

  return { page, pageSize, total, totalPages, applyMeta }
}
