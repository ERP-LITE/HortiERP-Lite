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
  createdAt: string
  updatedAt: string
}

export interface Unit {
  id: string
  name: string
  abbreviation: string
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
  minStock: string
  currentStock: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductWithRelations extends Product {
  category: Category
  unit: Unit
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
  notes: string | null
  lossDate: string
  createdAt: string
  createdByUser: { id: string; name: string } | null
  product: Product
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
    totalsByUnit: DashboardQuantityByUnit[]
    products: DashboardProductQuantity[]
    otherProductsCount: number
  }[]
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
  /** Presente apenas em `/logs/technical` (super_admin) */
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
