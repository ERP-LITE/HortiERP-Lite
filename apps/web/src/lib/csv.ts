/**
 * Leitura e escrita de CSV pensadas para o Excel em português, que é de onde as planilhas
 * dos clientes vêm: separador `;`, acento dependente de BOM e vírgula decimal.
 */

// U+FEFF: marca invisível que diz ao Excel que o arquivo é UTF-8
const BOM = '\uFEFF'

function detectDelimiter(firstLine: string) {
  const candidates = [';', ',', '\t']
  let best = ';'
  let bestCount = 0

  for (const candidate of candidates) {
    let count = 0
    let quoted = false
    for (let index = 0; index < firstLine.length; index += 1) {
      const char = firstLine[index]
      if (char === '"') quoted = !quoted
      else if (char === candidate && !quoted) count += 1
    }
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }

  return best
}

function firstLogicalLine(text: string) {
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') quoted = !quoted
    else if ((char === '\n' || char === '\r') && !quoted) return text.slice(0, index)
  }
  return text
}

export function parseCsv(input: string): string[][] {
  const text = input.startsWith(BOM) ? input.slice(1) : input
  if (!text.trim()) return []

  const delimiter = detectDelimiter(firstLogicalLine(text))
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (quoted) {
      if (char === '"') {
        // Aspas duplicadas dentro de campo entre aspas representam uma aspa literal
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      // \r\n conta como uma quebra só
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Linha totalmente vazia costuma ser só o enter final do arquivo
  return rows.filter((item) => item.some((cell) => cell.trim() !== ''))
}

function escapeCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Gera o CSV com `;` e BOM porque é o que o Excel em português abre com as colunas já
 * separadas e os acentos corretos — com `,` ele joga a linha inteira numa célula só.
 */
export function toCsv(headers: string[], rows: unknown[][]) {
  const lines = [headers.map(escapeCell).join(';')]
  for (const row of rows) lines.push(row.map(escapeCell).join(';'))
  return BOM + lines.join('\r\n')
}

/**
 * Número no formato brasileiro. Sem isso o Excel em português trata "7.49" como texto (ou
 * pior, como data), e a coluna exportada não soma. Como o separador do arquivo é `;`, a
 * vírgula decimal não conflita com nada.
 */
export function csvNumber(value: string | number | null | undefined, decimals = 2) {
  if (value === null || value === undefined || value === '') return ''
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return ''
  return parsed.toFixed(decimals).replace('.', ',')
}

export function downloadCsv(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Lê o arquivo tentando UTF-8 e caindo para Windows-1252, que o Excel ainda usa ao salvar. */
export async function readSpreadsheetFile(file: File) {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  // O caractere de substituição indica bytes que não são UTF-8 válido
  if (!utf8.includes('�')) return utf8
  return new TextDecoder('windows-1252').decode(buffer)
}
