import { and, eq, ilike } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { products } from '../../db/schema/index.js'

export function matchingProductIds(companyId: string, search: string) {
  return db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.companyId, companyId), ilike(products.name, `%${search}%`)))
}
