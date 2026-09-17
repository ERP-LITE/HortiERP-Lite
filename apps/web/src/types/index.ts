export interface PaginatedResult<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type UserRole = 'admin' | 'gerente' | 'operador' | 'super_admin'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  companyId: string
}

export interface SessionResponse {
  user: AuthUser
  impersonating: boolean
  companyName: string
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Company {
  id: string
  name: string
  legalName: string | null
  document: string | null
  stateRegistration: string | null
  contactName: string | null
  contactEmail: string | null
  phone: string | null
  postalCode: string | null
  street: string | null
  addressNumber: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  targetMargin: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Unit {
  id: string
  name: string
  abbreviation: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: string
  categoryId: string
  unitId: string
  name: string
  sku: string | null
  barcode: string | null
  costPrice: string | null
  salePrice: string | null
  targetMargin: string | null
  minStock: string
  currentStock: string
  active: boolean
  // Calculados pela API a partir do custo, da venda e da margem alvo (a do produto ou a herdada da
  // categoria). Ver docs/decisoes-arquiteturais.md.
  currentMargin: number | null
  effectiveTargetMargin: number | null
  targetMarginInherited: boolean
  suggestedPrice: number | null
  createdAt: string
  updatedAt: string
}

export interface ProductWithRelations extends Product {
  category: Category
  unit: Unit
}

export interface NotaFiscalItemLido {
  codigoDoFornecedor: string | null
  codigoDeBarras: string | null
  descricao: string
  unidade: string | null
  quantidade: number
  valorUnitario: number | null
  valorTotal: number | null
  productId: string | null
  productName: string | null
  vinculadoPor: 'codigo-de-barras' | 'de-para' | null
}

export interface NotaFiscalLida {
  emitenteDocumento: string | null
  emitenteNome: string | null
  numero: string | null
  serie: string | null
  chaveDeAcesso: string | null
  emitidaEm: string | null
  valorTotal: number | null
  itens: NotaFiscalItemLido[]
}

export interface StockEntryItem {
  id: string
  stockEntryId: string
  productId: string
  quantity: string
  unitCost: string | null
  product: ProductWithRelations
}

export interface StockEntry {
  id: string
  supplierName: string | null
  entryDate: string
  notes: string | null
  invoiceNumber: string | null
  invoiceSeries: string | null
  invoiceAccessKey: string | null
  invoiceIssuedAt: string | null
  invoiceTotal: string | null
  createdAt: string
  createdByUser: { id: string; name: string } | null
  items: StockEntryItem[]
  attachments: StockEntryAttachment[]
}

export interface StockEntrySummary extends Omit<StockEntry, 'attachments'> {
  attachments: Pick<StockEntryAttachment, 'id'>[]
}

export interface StockEntryAttachment {
  id: string
  stockEntryId: string
  originalName: string
  mimeType: string
  size: number
  createdAt: string
}

export type LossReason = 'vencido' | 'avariado' | 'roubo_furto' | 'erro_operacional' | 'outro'

export interface Loss {
  id: string
  productId: string
  quantity: string
  reason: LossReason
  unitCost: string | null
  notes: string | null
  lossDate: string
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  createdByUser: { id: string; name: string } | null
  product: Product
}

export type StockCountStatus = 'em_andamento' | 'em_conferencia' | 'concluida' | 'cancelada'

export interface StockCountTotals {
  itemsCount: number
  countedCount: number
  pendingCount: number
  divergentCount: number
  /** Sobra e falta em reais; a falta já vem positiva. Ambas ficam zeradas na contagem cega. */
  positiveValue: number
  negativeValue: number
  netValue: number
}

export interface StockCountSummary {
  id: string
  status: StockCountStatus
  categoryId: string | null
  categoryName: string | null
  notes: string | null
  startedAt: string
  finishedAt: string | null
  createdByUser: { id: string; name: string } | null
  itemsCount: number
  countedCount: number
}

export interface StockCount {
  id: string
  status: StockCountStatus
  categoryId: string | null
  categoryName: string | null
  notes: string | null
  cancelReason: string | null
  startedAt: string
  finishedAt: string | null
  createdByUser: { id: string; name: string } | null
  /** Falso enquanto a contagem está cega: aí saldo, custo e divergência vêm nulos ou zerados. */
  revelada: boolean
  resumo: StockCountTotals
}

export interface StockCountItem {
  productId: string
  productName: string
  sku: string | null
  barcode: string | null
  categoryName: string
  unitAbbreviation: string
  countedQuantity: string | null
  countedAt: string | null
  previousQuantity: string | null
  unitCost: string | null
  difference: number | null
  differenceValue: number | null
}

export type MovementType = 'entrada' | 'perda' | 'ajuste'

export interface StockMovement {
  id: string
  productId: string
  type: MovementType
  quantity: string
  balanceAfter: string
  referenceType: string
  referenceId: string
  notes: string | null
  movementDate: string
  createdAt: string
  createdByUser: { id: string; name: string } | null
  product: Product
}

export interface DashboardSummary {
  totalProducts: number
  lowStockCount: number
  lowStockProducts: Product[]
  stockValue: number
  periodFrom: string
  periodTo: string
  lossesInPeriod: {
    lossesCount: number
    lossValue: number
    totalsByUnit: DashboardQuantityByUnit[]
  }
  shrinkage: ShrinkageSummary
  recentMovements: StockMovement[]
  movementsTimeline: {
    date: string
    entradaCount: number
    perdaCount: number
    ajusteCount: number
    entradaByUnit: DashboardQuantityByUnit[]
    perdaByUnit: DashboardQuantityByUnit[]
    ajusteByUnit: DashboardQuantityByUnit[]
    entradaProducts: DashboardProductQuantity[]
    entradaOtherProductsCount: number
    perdaProducts: DashboardProductQuantity[]
    perdaOtherProductsCount: number
    ajusteProducts: DashboardProductQuantity[]
    ajusteOtherProductsCount: number
  }[]
  stockByCategory: {
    categoryId: string
    categoryName: string
    productCount: number
    totalsByUnit: DashboardQuantityByUnit[]
    products: DashboardProductQuantity[]
    otherProductsCount: number
  }[]
  lossesByReason: {
    reason: LossReason
    lossesCount: number
    lossValue: number
    totalsByUnit: DashboardQuantityByUnit[]
    products: DashboardProductQuantity[]
    otherProductsCount: number
  }[]
}

export interface ShrinkageSummary {
  lossValue: number
  entriesValue: number
  percent: number | null
  targetPercent: number
}

export interface DashboardQuantityByUnit {
  unitId: string
  unitName: string
  unitAbbreviation: string
  quantity: number
}

export interface DashboardProductQuantity {
  productId: string
  productName: string
  quantity: number
  unitAbbreviation: string
}

export type SystemLogLevel = 'info' | 'warning' | 'error'
export type SystemLogMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ActivityAction = 'criou' | 'alterou' | 'excluiu' | 'importou' | 'ajustou' | 'cancelou'
export type ActivityEntity =
  | 'produto'
  | 'categoria'
  | 'unidade'
  | 'usuario'
  | 'entrada'
  | 'perda'
  | 'estoque'
  | 'contagem'

export interface ActivityLog {
  id: string
  action: ActivityAction
  entity: ActivityEntity
  entityId: string | null
  entityLabel: string
  details: Record<string, unknown> | null
  createdAt: string
  actorId: string | null
  actorName: string | null
  actorEmail: string | null
  actorRole: UserRole | null
}

export interface SystemLog {
  id: string
  companyId: string | null
  companyName: string | null
  actorId: string | null
  actorName: string | null
  actorEmail: string | null
  actorRole: UserRole | null
  method: SystemLogMethod
  path: string
  statusCode: number
  level: SystemLogLevel
  createdAt: string
  durationMs?: number
  errorCode?: string | null
  errorMessage?: string | null
  ip?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}

export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    issues?: Record<string, string[] | undefined>
  }
}
