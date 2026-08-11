import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from '../errors/AppError.js'

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    request.technicalError = { code: error.code, message: error.message }
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.issues ? { issues: error.issues } : {}),
      },
    })
  }

  if (error instanceof ZodError) {
    request.technicalError = { code: 'VALIDATION_ERROR', message: 'Dados inválidos' }
    return reply.status(422).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        issues: error.flatten().fieldErrors,
      },
    })
  }

  const databaseError =
    'code' in error && error.code === '23505'
      ? error
      : 'cause' in error && error.cause instanceof Error && 'code' in error.cause && error.cause.code === '23505'
        ? error.cause
        : null
  if (databaseError) {
    const constraint =
      'constraint' in databaseError && typeof databaseError.constraint === 'string' ? databaseError.constraint : ''
    const duplicateByConstraint: Record<string, { field: string; message: string }> = {
      categories_company_name_active_unique: { field: 'name', message: 'Já existe uma categoria com esse nome' },
      units_company_name_active_unique: { field: 'name', message: 'Já existe uma unidade com esse nome' },
      units_company_abbreviation_active_unique: {
        field: 'abbreviation',
        message: 'Já existe uma unidade com essa abreviação',
      },
      products_company_name_active_unique: { field: 'name', message: 'Já existe um produto com esse nome' },
      products_company_sku_active_unique: { field: 'sku', message: 'Já existe um produto com esse SKU' },
      companies_document_active_unique: { field: 'document', message: 'Já existe uma empresa com esse CNPJ' },
      users_email_unique: { field: 'email', message: 'Já existe um usuário com esse e-mail' },
      company_billings_company_reference_unique: {
        field: 'referenceMonth',
        message: 'Já existe uma cobrança para essa empresa e competência',
      },
    }
    const duplicate = duplicateByConstraint[constraint]
    const message = duplicate?.message ?? 'Já existe um registro com esses dados'
    request.technicalError = { code: 'DUPLICATE_ENTRY', message }
    return reply.status(409).send({
      error: {
        code: 'DUPLICATE_ENTRY',
        message,
        ...(duplicate ? { issues: { [duplicate.field]: [message] } } : {}),
      },
    })
  }

  if ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) {
    request.technicalError = { code: error.code ?? 'ERROR', message: error.message }
    return reply.status(error.statusCode).send({
      error: {
        code: error.code ?? 'ERROR',
        message: error.message,
      },
    })
  }

  request.log.error(error)
  request.technicalError = { code: 'INTERNAL_SERVER_ERROR', message: error.message }

  return reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor',
    },
  })
}
