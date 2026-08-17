import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from '../errors/AppError.js'
import { frameworkErrorMessage } from '../errors/frameworkMessages.js'
import {
  UNIQUE_CONSTRAINTS,
  uniqueViolationConstraint,
  type UniqueConstraintName,
} from '../db/uniqueConstraints.js'

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

  const constraint = uniqueViolationConstraint(error)
  if (constraint !== undefined) {
    const duplicate = UNIQUE_CONSTRAINTS[constraint as UniqueConstraintName]
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
    const code = error.code ?? 'ERROR'
    request.technicalError = { code, message: error.message }
    return reply.status(error.statusCode).send({
      error: {
        code,
        message: frameworkErrorMessage(error.code, error.statusCode),
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
