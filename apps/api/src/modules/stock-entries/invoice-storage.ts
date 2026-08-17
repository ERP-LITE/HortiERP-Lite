import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, open, rm, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import type { MultipartFile } from '@fastify/multipart'
import { db } from '../../db/client.js'
import { stockEntryAttachments } from '../../db/schema/index.js'
import { count, eq, sql } from 'drizzle-orm'
import { env } from '../../shared/config/env.js'
import { AppError } from '../../shared/errors/AppError.js'
import { fileTooLargeMessage } from '../../shared/errors/frameworkMessages.js'

const allowedFiles = new Map<string, { extension: string; previewable: boolean }>([
  ['application/pdf', { extension: '.pdf', previewable: true }],
  ['application/xml', { extension: '.xml', previewable: false }],
  ['text/xml', { extension: '.xml', previewable: false }],
  ['image/jpeg', { extension: '.jpg', previewable: true }],
  ['image/png', { extension: '.png', previewable: true }],
  ['image/webp', { extension: '.webp', previewable: true }],
])

const MAX_ATTACHMENTS_PER_ENTRY = 3

async function hasValidSignature(path: string, mimeType: string) {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(512)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const header = buffer.subarray(0, bytesRead)
    if (mimeType === 'application/pdf') return header.subarray(0, 5).toString() === '%PDF-'
    if (mimeType === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    if (mimeType === 'image/png') return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    if (mimeType === 'image/webp') return header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP'
    if (mimeType === 'application/xml' || mimeType === 'text/xml') {
      return header.toString('utf8').replace(/^\uFEFF/, '').trimStart().startsWith('<')
    }
    return false
  } finally {
    await handle.close()
  }
}

export function isPreviewableInvoiceFile(mimeType: string) {
  return allowedFiles.get(mimeType)?.previewable ?? false
}

export function invoiceFilePath(storedName: string) {
  return join(env.INVOICE_STORAGE_PATH, storedName)
}

export function openInvoiceFile(storedName: string) {
  return createReadStream(invoiceFilePath(storedName))
}

export async function deleteInvoiceFile(storedName: string) {
  await rm(invoiceFilePath(storedName), { force: true })
}

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

async function countAttachments(executor: DbExecutor, stockEntryId: string) {
  const [{ total }] = await executor
    .select({ total: count() })
    .from(stockEntryAttachments)
    .where(eq(stockEntryAttachments.stockEntryId, stockEntryId))
  return total
}

function attachmentLimitError() {
  return new AppError(
    `Cada entrada aceita no máximo ${MAX_ATTACHMENTS_PER_ENTRY} anexos`,
    422,
    'ATTACHMENT_LIMIT',
  )
}

export async function storeInvoiceAttachment(
  companyId: string,
  userId: string,
  stockEntryId: string,
  file: MultipartFile,
) {
  const originalExtension = extname(file.filename).toLowerCase()
  const inferredMimeType =
    file.mimetype === 'application/octet-stream' && originalExtension === '.xml' ? 'application/xml' : file.mimetype
  const allowed = allowedFiles.get(inferredMimeType)
  if (!allowed) {
    file.file.resume()
    throw new AppError('Formato inválido. Envie XML, PDF, JPG, PNG ou WEBP', 422, 'INVALID_FILE_TYPE')
  }

  if (originalExtension && originalExtension !== allowed.extension && !(allowed.extension === '.jpg' && originalExtension === '.jpeg')) {
    file.file.resume()
    throw new AppError('A extensão do arquivo não corresponde ao formato enviado', 422, 'INVALID_FILE_TYPE')
  }

  if ((await countAttachments(db, stockEntryId)) >= MAX_ATTACHMENTS_PER_ENTRY) {
    file.file.resume()
    throw attachmentLimitError()
  }

  await mkdir(env.INVOICE_STORAGE_PATH, { recursive: true, mode: 0o700 })
  const storedName = `${randomUUID()}${allowed.extension}`
  const path = invoiceFilePath(storedName)

  try {
    await pipeline(file.file, createWriteStream(path, { flags: 'wx', mode: 0o600 }))
    // O `limit` do @fastify/multipart só marca `truncated`: quem consome o stream por conta
    // própria (em vez de `toBuffer()`) recebe um stream que termina normalmente.
    if (file.file.truncated) {
      throw new AppError(fileTooLargeMessage(), 413, 'FST_REQ_FILE_TOO_LARGE')
    }
    if (!(await hasValidSignature(path, inferredMimeType))) {
      throw new AppError('O conteúdo do arquivo não corresponde ao formato informado', 422, 'INVALID_FILE_CONTENT')
    }
    const storedFile = await stat(path)

    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${stockEntryId}, 0))`)
      if ((await countAttachments(tx, stockEntryId)) >= MAX_ATTACHMENTS_PER_ENTRY) {
        throw attachmentLimitError()
      }

      const [attachment] = await tx
        .insert(stockEntryAttachments)
        .values({
          companyId,
          stockEntryId,
          originalName: file.filename.slice(0, 255),
          storedName,
          mimeType: inferredMimeType,
          size: storedFile.size,
          createdBy: userId,
        })
        .returning({
          id: stockEntryAttachments.id,
          stockEntryId: stockEntryAttachments.stockEntryId,
          originalName: stockEntryAttachments.originalName,
          mimeType: stockEntryAttachments.mimeType,
          size: stockEntryAttachments.size,
          createdAt: stockEntryAttachments.createdAt,
        })
      return attachment
    })
  } catch (error) {
    await rm(path, { force: true })
    throw error
  }
}
