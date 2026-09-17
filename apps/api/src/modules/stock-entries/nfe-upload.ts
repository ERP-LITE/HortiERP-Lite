import { extname } from 'node:path'
import type { MultipartFile } from '@fastify/multipart'
import { AppError } from '../../shared/errors/AppError.js'
import { fileTooLargeMessage } from '../../shared/errors/frameworkMessages.js'

const TIPOS_DE_XML = new Set(['application/xml', 'text/xml'])

/**
 * Lê o XML enviado como texto, sem gravar em disco: esta rota só interpreta o arquivo. O anexo em si
 * continua subindo pelo caminho de sempre, depois que a entrada existe.
 */
export async function lerXmlEnviado(file: MultipartFile | undefined) {
  if (!file) throw new AppError('Arquivo não enviado', 422, 'FILE_REQUIRED')

  const extensao = extname(file.filename).toLowerCase()
  const tipo = file.mimetype === 'application/octet-stream' && extensao === '.xml' ? 'application/xml' : file.mimetype
  if (!TIPOS_DE_XML.has(tipo) || (extensao && extensao !== '.xml')) {
    file.file.resume()
    throw new AppError('Envie o arquivo XML da nota fiscal', 422, 'INVALID_FILE_TYPE')
  }

  const conteudo = await file.toBuffer()
  // `toBuffer()` respeita o limite do multipart e devolve o que coube, marcando `truncated`. Sem
  // esta checagem, um XML cortado no meio viraria "arquivo inválido" em vez de "arquivo grande".
  if (file.file.truncated) throw new AppError(fileTooLargeMessage(), 413, 'FILE_TOO_LARGE')

  return conteudo.toString('utf8').replace(/^﻿/, '')
}
