import { z } from 'zod'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const listStockEntriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(['entryDate', 'supplierName', 'invoiceStatus', 'invoiceTotal']).optional(),
})

export type ListStockEntriesQuery = z.infer<typeof listStockEntriesQuerySchema>

export const stockEntryItemSchema = z.object({
  productId: z.string().uuid('Produto inválido'),
  quantity: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  unitCost: z.coerce.number().nonnegative().optional(),
})

export const createStockEntrySchema = z.object({
  supplierName: z.string().trim().max(200).optional(),
  entryDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
  invoiceNumber: z.string().trim().max(60).optional(),
  invoiceSeries: z.string().trim().max(20).optional(),
  invoiceAccessKey: z.string().trim().regex(/^\d{44}$/, 'A chave da NF-e deve ter 44 dígitos').optional(),
  invoiceIssuedAt: z.coerce.date().optional(),
  invoiceTotal: z.coerce.number().nonnegative('O valor total não pode ser negativo').optional(),
  items: z.array(stockEntryItemSchema).min(1, 'Informe ao menos um item'),
})

export type CreateStockEntryInput = z.infer<typeof createStockEntrySchema>

export const updateStockEntryDetailsSchema = z.object({
  supplierName: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  invoiceNumber: z.string().trim().max(60).nullable().optional(),
  invoiceSeries: z.string().trim().max(20).nullable().optional(),
  invoiceAccessKey: z
    .string()
    .trim()
    .regex(/^\d{44}$/, 'A chave da NF-e deve ter 44 dígitos')
    .nullable()
    .optional(),
  invoiceIssuedAt: z.coerce.date().nullable().optional(),
  invoiceTotal: z.coerce.number().nonnegative('O valor total não pode ser negativo').nullable().optional(),
})

export type UpdateStockEntryDetailsInput = z.infer<typeof updateStockEntryDetailsSchema>
