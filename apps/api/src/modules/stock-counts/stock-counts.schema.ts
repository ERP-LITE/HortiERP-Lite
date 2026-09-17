import { z } from 'zod'
import { LIMITES_NUMERO, LIMITES_TEXTO } from '../../shared/schemas/limits.js'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const STOCK_COUNT_STATUS = ['em_andamento', 'em_conferencia', 'concluida', 'cancelada'] as const

export type StockCountStatus = (typeof STOCK_COUNT_STATUS)[number]

export const createStockCountSchema = z.object({
  categoryId: z.string().uuid('Categoria inválida').optional(),
  notes: z.string().trim().max(LIMITES_TEXTO.observacoes).optional(),
})

export type CreateStockCountInput = z.infer<typeof createStockCountSchema>

export const listStockCountsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(STOCK_COUNT_STATUS).optional(),
  sortBy: z.enum(['startedAt', 'finishedAt', 'status']).optional(),
})

export type ListStockCountsQuery = z.infer<typeof listStockCountsQuerySchema>

const SITUACOES_DO_ITEM = ['todos', 'pendentes', 'contados', 'divergentes'] as const

export const listStockCountItemsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  situacao: z.enum(SITUACOES_DO_ITEM).default('todos'),
})

export type ListStockCountItemsQuery = z.infer<typeof listStockCountItemsQuerySchema>

export const countStockCountItemSchema = z.object({
  // Nulo apaga o lançamento e devolve o produto para a fila de pendentes, que é como se desfaz um
  // número digitado errado sem ter de inventar um valor.
  countedQuantity: z.coerce
    .number()
    .min(0, 'Quantidade não pode ser negativa')
    .max(LIMITES_NUMERO.quantidade)
    .nullable(),
})

export const cancelStockCountSchema = z.object({
  cancelReason: z.string().trim().min(1, 'Explique o motivo do cancelamento').max(LIMITES_TEXTO.motivo),
})

export type CancelStockCountInput = z.infer<typeof cancelStockCountSchema>
