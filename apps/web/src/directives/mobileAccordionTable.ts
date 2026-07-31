import type { Directive } from 'vue'

const interactiveSelector = 'button, a, input, select, textarea, label'

function decorate(table: HTMLTableElement) {
  const labels = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th')).map((cell) =>
    cell.textContent?.trim() ?? '',
  )

  table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
    const cells = Array.from(row.cells)
    cells.forEach((cell, index) => {
      cell.dataset.mobileLabel = labels[index] ?? ''
      cell.classList.remove('mobile-accordion-summary')
      const isSelection = Boolean(cell.querySelector('input[type="checkbox"], [role="checkbox"]'))
      cell.classList.toggle('mobile-accordion-selection', isSelection)
      cell.classList.toggle(
        'mobile-accordion-actions',
        !isSelection && !cell.dataset.mobileLabel && Boolean(cell.querySelector('button, a')),
      )
    })

    if (cells.some((cell) => cell.colSpan > 1)) {
      row.classList.add('mobile-accordion-static')
      return
    }

    row.classList.remove('mobile-accordion-static')
    if (!row.dataset.mobileAccordionInitialized) {
      row.classList.add('mobile-accordion-open')
      row.dataset.mobileAccordionInitialized = 'true'
    }
    const summary = cells.find((cell) => Boolean(cell.dataset.mobileLabel))
    if (summary) {
      summary.classList.add('mobile-accordion-summary')
      summary.tabIndex = 0
      summary.setAttribute('role', 'button')
      summary.setAttribute('aria-expanded', String(row.classList.contains('mobile-accordion-open')))
    }
  })
}

function toggle(row: HTMLTableRowElement) {
  row.classList.toggle('mobile-accordion-open')
  row.querySelector('.mobile-accordion-summary')?.setAttribute(
    'aria-expanded',
    String(row.classList.contains('mobile-accordion-open')),
  )
}

export const mobileAccordionTable: Directive<HTMLTableElement> = {
  mounted(table) {
    decorate(table)
    const handler = (event: Event) => {
      if (window.matchMedia('(min-width: 640px)').matches) return
      const target = event.target as HTMLElement
      if (target.closest(interactiveSelector) && !target.closest('.mobile-accordion-summary')) return
      const summary = target.closest<HTMLTableCellElement>('.mobile-accordion-summary')
      if (!summary) return
      if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return
      if (event instanceof KeyboardEvent) event.preventDefault()
      const row = summary.closest<HTMLTableRowElement>('tr')
      if (row) toggle(row)
    }
    table.addEventListener('click', handler)
    table.addEventListener('keydown', handler)
    ;(table as HTMLTableElement & { _mobileAccordionHandler?: EventListener })._mobileAccordionHandler = handler
  },
  updated: decorate,
  unmounted(table) {
    const handler = (table as HTMLTableElement & { _mobileAccordionHandler?: EventListener })._mobileAccordionHandler
    if (handler) {
      table.removeEventListener('click', handler)
      table.removeEventListener('keydown', handler)
    }
  },
}
