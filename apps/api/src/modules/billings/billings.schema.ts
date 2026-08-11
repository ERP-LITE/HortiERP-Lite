import { z } from 'zod'
import { paginationQuerySchema } from '../../shared/schemas/pagination.schema.js'

export const billingStatuses = ['pending', 'paid', 'overdue'] as const
export type BillingStatus = (typeof billingStatuses)[number]

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Competência inválida')
const dateSchema = z.string().date('Data inválida')
const moneySchema = z.coerce.number().positive('O valor deve ser maior que zero').max(9999999999)

export const listBillingsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  status: z.enum(billingStatuses).optional(),
  sortBy: z.enum(['companyName', 'referenceMonth', 'dueDate', 'amount', 'paidAt']).optional(),
})

const billingFields = z.object({
  companyId: z.string().uuid('Empresa inválida'),
  referenceMonth: monthSchema,
  dueDate: dateSchema,
  amount: moneySchema,
  paidAmount: z.coerce.number().positive('O valor pago deve ser maior que zero').max(9999999999).nullable().optional(),
  paidAt: dateSchema.nullable().optional(),
  notes: z.string().trim().max(500, 'Observações devem ter no máximo 500 caracteres').nullable().optional(),
})

function paymentFieldsMatch(data: { paidAmount?: number | null; paidAt?: string | null }, context: z.RefinementCtx) {
  if (Boolean(data.paidAmount) !== Boolean(data.paidAt)) {
    context.addIssue({ code: 'custom', path: ['paidAmount'], message: 'Informe o valor e a data do pagamento' })
  }
}

export const createBillingSchema = billingFields.superRefine(paymentFieldsMatch)
export const updateBillingSchema = billingFields.superRefine(paymentFieldsMatch)

export type ListBillingsQuery = z.infer<typeof listBillingsQuerySchema>
export type CreateBillingInput = z.infer<typeof createBillingSchema>
export type UpdateBillingInput = z.infer<typeof updateBillingSchema>
