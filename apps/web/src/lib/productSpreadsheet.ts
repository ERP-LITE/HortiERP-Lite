import type { ImportProductRow } from '@/services/productsService'

export const TEMPLATE_HEADERS = [
  'nome',
  'categoria',
  'unidade',
  'codigo',
  'codigo de barras',
  'custo',
  'preco de venda',
  'estoque minimo',
  'estoque atual',
  'ativo',
]

type Field = keyof Omit<ImportProductRow, 'line'>

/** A planilha do cliente raramente usa o cabeçalho exato do modelo, então cada campo
 *  aceita os nomes mais prováveis. A comparação ignora acento, caixa e pontuação. */
const HEADER_ALIASES: Record<Field, string[]> = {
  name: ['nome', 'produto', 'descricao', 'nome do produto', 'item'],
  categoryName: ['categoria', 'grupo', 'setor', 'departamento'],
  unitName: ['unidade', 'unidade de medida', 'un', 'medida', 'und'],
  sku: ['codigo', 'sku', 'referencia', 'cod', 'codigo interno', 'ref'],
  barcode: ['codigo de barras', 'barras', 'ean', 'gtin', 'cod barras'],
  costPrice: ['custo', 'preco de custo', 'valor de custo', 'custo unitario'],
  salePrice: ['preco de venda', 'venda', 'preco', 'valor de venda', 'preco venda'],
  minStock: ['estoque minimo', 'minimo', 'estoque min', 'min'],
  currentStock: ['estoque atual', 'estoque', 'quantidade', 'qtd', 'saldo', 'estoque inicial'],
  active: ['ativo', 'situacao', 'status'],
}

export const REQUIRED_FIELDS: Field[] = ['name', 'categoryName', 'unitName']

export const FIELD_LABELS: Record<Field, string> = {
  name: 'nome',
  categoryName: 'categoria',
  unitName: 'unidade',
  sku: 'código',
  barcode: 'código de barras',
  costPrice: 'custo',
  salePrice: 'preço de venda',
  minStock: 'estoque mínimo',
  currentStock: 'estoque atual',
  active: 'ativo',
}

export function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export interface SpreadsheetMapping {
  rows: ImportProductRow[]
  missingFields: Field[]
  headerRow: string[]
}

/**
 * Converte a tabela lida do CSV nas linhas que a API espera. A numeração das linhas é
 * deslocada em 2 (cabeçalho + planilha começa no 1) para que o número mostrado no erro
 * seja o mesmo que o cliente enxerga aberto no Excel.
 */
export function mapSpreadsheetToRows(table: string[][]): SpreadsheetMapping {
  const headerRow = table[0] ?? []
  const headers = headerRow.map(normalizeHeader)

  const columnOf = {} as Partial<Record<Field, number>>
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
    const index = headers.findIndex((header) => aliases.includes(header))
    if (index >= 0) columnOf[field] = index
  }

  const missingFields = REQUIRED_FIELDS.filter((field) => columnOf[field] === undefined)
  if (missingFields.length > 0) return { rows: [], missingFields, headerRow }

  const cell = (row: string[], field: Field) => {
    const index = columnOf[field]
    return index === undefined ? undefined : (row[index] ?? '').trim() || undefined
  }

  const rows = table.slice(1).map((row, index) => ({
    line: index + 2,
    name: cell(row, 'name') ?? '',
    categoryName: cell(row, 'categoryName') ?? '',
    unitName: cell(row, 'unitName') ?? '',
    sku: cell(row, 'sku'),
    barcode: cell(row, 'barcode'),
    costPrice: cell(row, 'costPrice'),
    salePrice: cell(row, 'salePrice'),
    minStock: cell(row, 'minStock'),
    currentStock: cell(row, 'currentStock'),
    active: cell(row, 'active'),
  }))

  return { rows, missingFields: [], headerRow }
}
