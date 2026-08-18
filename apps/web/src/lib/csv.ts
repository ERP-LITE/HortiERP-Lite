
const BOM = '\uFEFF'

/**
 * Excel e LibreOffice avaliam como **fórmula** toda célula que comece com `=`, `+`, `-`, `@`,
 * tabulação ou retorno de carro. Como as planilhas exportadas levam texto digitado pelo usuário
 * (nome de produto, observação, motivo), um valor como `=HYPERLINK("http://…"&A1;"clique")` viraria
 * fórmula viva na máquina de quem abre o arquivo — quem exporta é normalmente o administrador, e
 * quem digitou pode ser um operador. O apóstrofo à frente faz a planilha tratar a célula como texto
 * e não é exibido.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

/**
 * Número no formato brasileiro, inclusive negativo. Ele dispara o `-` do teste acima sem ser
 * ameaça, e prefixá-lo transformaria quantidade em texto — a planilha pararia de somar a coluna.
 */
const NUMERIC_CELL = /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/

function protectFromFormula(text: string) {
  if (!FORMULA_TRIGGER.test(text) || NUMERIC_CELL.test(text)) return text
  return `'${text}`
}

/** Inverso de `protectFromFormula`, para o arquivo exportado voltar pela importação sem o apóstrofo. */
function unprotectFromFormula(text: string) {
  return text.startsWith("'") && FORMULA_TRIGGER.test(text.slice(1)) ? text.slice(1) : text
}

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

  return rows
    .filter((item) => item.some((cell) => cell.trim() !== ''))
    .map((item) => item.map(unprotectFromFormula))
}

function escapeCell(value: unknown) {
  const text = protectFromFormula(value === null || value === undefined ? '' : String(value))
  return /[";,\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers: string[], rows: unknown[][]) {
  const lines = [headers.map(escapeCell).join(';')]
  for (const row of rows) lines.push(row.map(escapeCell).join(';'))
  return BOM + lines.join('\r\n')
}

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

export async function readSpreadsheetFile(file: File) {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  if (!utf8.includes('�')) return utf8
  return new TextDecoder('windows-1252').decode(buffer)
}