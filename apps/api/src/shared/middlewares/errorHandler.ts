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
