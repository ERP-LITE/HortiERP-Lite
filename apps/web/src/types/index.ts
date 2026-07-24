export interface PaginatedResult<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type UserRole = 'admin' | 'gerente' | 'operador'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  companyId: string
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
  product: Product
}

export interface StockEntry {
  id: string
  supplierName: string | null
  entryDate: string
  notes: string | null
  createdAt: string
  items: StockEntryItem[]
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
  createdAt: string
  product: Product
}

export interface DashboardSummary {
  totalProducts: number
  lowStockCount: number
  lowStockProducts: Product[]
  stockValue: number
  last30Days: {
    lossesCount: number
    lossesQuantity: number
  }
  recentMovements: StockMovement[]
  movementsTimeline: { date: string; entrada: number; perda: number }[]
  stockByCategory: { categoryId: string; categoryName: string; totalStock: number }[]
  lossesByReason: { reason: LossReason; quantity: number }[]
}

export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    issues?: Record<string, string[] | undefined>
  }
}
