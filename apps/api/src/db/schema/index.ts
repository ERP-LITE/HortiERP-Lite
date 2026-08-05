import { relations } from 'drizzle-orm'
import { companies } from './companies.js'
import { users } from './users.js'
import { categories } from './categories.js'
import { units } from './units.js'
import { products } from './products.js'
import { stockEntries, stockEntryItems } from './stockEntries.js'
import { losses } from './losses.js'
import { stockMovements } from './stockMovements.js'
import { systemLogs } from './systemLogs.js'

export * from './enums.js'
export * from './companies.js'
export * from './users.js'
export * from './categories.js'
export * from './units.js'
export * from './products.js'
export * from './stockEntries.js'
export * from './losses.js'
export * from './stockMovements.js'
export * from './systemLogs.js'

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  categories: many(categories),
  units: many(units),
  products: many(products),
  systemLogs: many(systemLogs),
}))

export const systemLogsRelations = relations(systemLogs, ({ one }) => ({
  company: one(companies, { fields: [systemLogs.companyId], references: [companies.id] }),
  actor: one(users, { fields: [systemLogs.actorId], references: [users.id] }),
}))

export const usersRelations = relations(users, ({ one }) => ({
  company: one(companies, { fields: [users.companyId], references: [companies.id] }),
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  company: one(companies, { fields: [categories.companyId], references: [companies.id] }),
  products: many(products),
}))

export const unitsRelations = relations(units, ({ one, many }) => ({
  company: one(companies, { fields: [units.companyId], references: [companies.id] }),
  products: many(products),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  company: one(companies, { fields: [products.companyId], references: [companies.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  unit: one(units, { fields: [products.unitId], references: [units.id] }),
  stockEntryItems: many(stockEntryItems),
  losses: many(losses),
  movements: many(stockMovements),
}))

export const stockEntriesRelations = relations(stockEntries, ({ one, many }) => ({
  company: one(companies, { fields: [stockEntries.companyId], references: [companies.id] }),
  createdByUser: one(users, { fields: [stockEntries.createdBy], references: [users.id] }),
  items: many(stockEntryItems),
}))

export const stockEntryItemsRelations = relations(stockEntryItems, ({ one }) => ({
  stockEntry: one(stockEntries, { fields: [stockEntryItems.stockEntryId], references: [stockEntries.id] }),
  product: one(products, { fields: [stockEntryItems.productId], references: [products.id] }),
}))

export const lossesRelations = relations(losses, ({ one }) => ({
  company: one(companies, { fields: [losses.companyId], references: [companies.id] }),
  product: one(products, { fields: [losses.productId], references: [products.id] }),
  createdByUser: one(users, { fields: [losses.createdBy], references: [users.id] }),
}))

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  company: one(companies, { fields: [stockMovements.companyId], references: [companies.id] }),
  product: one(products, { fields: [stockMovements.productId], references: [products.id] }),
}))
