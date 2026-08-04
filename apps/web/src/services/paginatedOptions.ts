import type { PaginatedResult } from '@/types'

const OPTIONS_PAGE_SIZE = 100

export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResult<T>>,
): Promise<T[]> {
  const first = await fetchPage(1, OPTIONS_PAGE_SIZE)
  if (first.totalPages <= 1) return first.data

  const remaining = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) => fetchPage(index + 2, OPTIONS_PAGE_SIZE)),
  )
  return [first, ...remaining].flatMap((result) => result.data)
}
