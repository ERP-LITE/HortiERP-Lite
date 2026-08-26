import { z } from 'zod'
import { eventDateSchema } from '../../shared/schemas/eventDate.schema.js'
import { LIMITES_NUMERO, LIMITES_TEXTO } from '../../shared/schemas/limits.js'
import { periodQueryFields } from '../../shared/schemas/period.schema.js'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listStockEntriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(LIMITES_TEXTO.busca).optional(),
  ...periodQueryFields,
  sortBy: z.enum(['entryDate', 'supplierName', 'invoiceStatus', 'invoiceTotal']).optional(),
})

export type ListStockEntriesQuery = z.infer<typeof listStockEntriesQuerySchema>

const CHAVE_NFE = new RegExp(`^\\d{${LIMITES_TEXTO.chaveNfe}}$`)
const CHAVE_NFE_INVALIDA = `A chave da NF-e deve ter ${LIMITES_TEXTO.chaveNfe} dígitos`

export const MAX_ITENS_POR_ENTRADA = 200

export const stockEntryItemSchema = z.object({
  productId: z.string().uuid('Produto inválido'),
  quantity: z.coerce.number().positive('Quantidade deve ser maior que zero').max(LIMITES_NUMERO.quantidade),
  unitCost: z.coerce.number().nonnegative().max(LIMITES_NUMERO.valorUnitario).optional(),
})

export const createStockEntrySchema = z.object({
  supplierName: z.string().trim().max(LIMITES_TEXTO.fornecedor).optional(),
  entryDate: eventDateSchema.optional(),
  notes: z.string().trim().max(LIMITES_TEXTO.observacoesEntrada).optional(),
  invoiceNumber: z.string().trim().max(LIMITES_TEXTO.numeroNota).optional(),
  invoiceSeries: z.string().trim().max(LIMITES_TEXTO.serieNota).optional(),
  invoiceAccessKey: z.string().trim().regex(CHAVE_NFE, CHAVE_NFE_INVALIDA).optional(),
  invoiceIssuedAt: z.coerce.date().optional(),
  invoiceTotal: z.coerce.number().nonnegative('O valor total não pode ser negativo').max(LIMITES_NUMERO.valorNota).optional(),
  items: z.array(stockEntryItemSchema).min(1, 'Informe ao menos um item').max(MAX_ITENS_POR_ENTRADA),
})

export type CreateStockEntryInput = z.infer<typeof createStockEntrySchema>

export const updateStockEntryDetailsSchema = z.object({
  supplierName: z.string().trim().max(LIMITES_TEXTO.fornecedor).nullable().optional(),
  notes: z.string().trim().max(LIMITES_TEXTO.observacoesEntrada).nullable().optional(),
  invoiceNumber: z.string().trim().max(LIMITES_TEXTO.numeroNota).nullable().optional(),
  invoiceSeries: z.string().trim().max(LIMITES_TEXTO.serieNota).nullable().optional(),
  invoiceAccessKey: z.string().trim().regex(CHAVE_NFE, CHAVE_NFE_INVALIDA).nullable().optional(),
  invoiceIssuedAt: z.coerce.date().nullable().optional(),
  invoiceTotal: z.coerce.number().nonnegative('O valor total não pode ser negativo').max(LIMITES_NUMERO.valorNota).nullable().optional(),
})

export type UpdateStockEntryDetailsInput = z.infer<typeof updateStockEntryDetailsSchema>
