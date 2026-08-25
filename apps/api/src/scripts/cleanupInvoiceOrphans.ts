import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { db, pool } from '../db/client.js'
import { stockEntryAttachments } from '../db/schema/index.js'
import { env } from '../shared/config/env.js'
import { comEscopoDePlataforma } from '../db/scope.js'

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000

async function run() {
  const dryRun = process.argv.includes('--dry-run')

  let diskFiles: string[]
  try {
    diskFiles = await readdir(env.INVOICE_STORAGE_PATH)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`Diretório ${env.INVOICE_STORAGE_PATH} não existe — nada a limpar.`)
      return
    }
    throw error
  }

  const registered = new Set(
    (await db.select({ storedName: stockEntryAttachments.storedName }).from(stockEntryAttachments)).map(
      (row) => row.storedName,
    ),
  )

  const cutoff = Date.now() - GRACE_PERIOD_MS
  let removed = 0
  let freedBytes = 0
  let skippedRecent = 0

  for (const fileName of diskFiles) {
    if (registered.has(fileName)) continue

    const path = join(env.INVOICE_STORAGE_PATH, fileName)
    const info = await stat(path)
    if (!info.isFile()) continue

    if (info.mtimeMs > cutoff) {
      skippedRecent += 1
      continue
    }

    if (dryRun) {
      console.log(`[dry-run] removeria ${fileName} (${info.size} bytes)`)
    } else {
      await rm(path, { force: true })
    }
    removed += 1
    freedBytes += info.size
  }

  const megabytes = (freedBytes / 1024 / 1024).toFixed(2)
  const prefix = dryRun ? '[dry-run] ' : ''
  console.log(
    `${prefix}${removed} arquivo(s) órfão(s) ${dryRun ? 'encontrados' : 'removidos'} (${megabytes} MB), ` +
      `${skippedRecent} ignorado(s) por estarem dentro da janela de ${GRACE_PERIOD_MS / 1000 / 60 / 60}h, ` +
      `${registered.size} anexo(s) registrado(s) preservado(s).`,
  )

}

comEscopoDePlataforma(run)
  .catch((error) => {
    console.error('Falha ao limpar anexos órfãos:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => {})
  })
