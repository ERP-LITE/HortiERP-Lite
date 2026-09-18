/** Violação de índice único. */
export const UNIQUE_VIOLATION = '23505'

function textProperty(value: unknown, property: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const found = (value as Record<string, unknown>)[property]
  return typeof found === 'string' ? found : undefined
}

/**
 * O erro do driver por trás do que o chamador recebeu, ou `undefined` quando o erro não veio do
 * banco. Confere também o `cause`, onde o Drizzle embrulha o erro do driver dentro de uma transação.
 */
function databaseError(error: unknown): unknown {
  if (textProperty(error, 'code') !== undefined) return error

  const cause = typeof error === 'object' && error !== null ? (error as { cause?: unknown }).cause : undefined
  return textProperty(cause, 'code') !== undefined ? cause : undefined
}

export function databaseErrorCode(error: unknown): string | undefined {
  return textProperty(databaseError(error), 'code')
}

export function databaseErrorProperty(error: unknown, property: string): string | undefined {
  return textProperty(databaseError(error), property)
}
