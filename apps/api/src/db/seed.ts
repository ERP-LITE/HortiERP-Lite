import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, pool } from './client.js'
import { comEscopoDePlataforma } from './scope.js'
import {
  categories,
  companies,
  losses,
  lossReasonEnum,
  products,
  stockEntries,
  stockEntryItems,
  stockMovements,
  units,
  users,
} from './schema/index.js'

type LossReason = (typeof lossReasonEnum.enumValues)[number]

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomItem<T>(list: T[]): T {
  return list[randomInt(0, list.length - 1)]
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function dateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(randomInt(7, 19), randomInt(0, 59), 0, 0)
  return date
}

/**
 * O seed cria contas de demonstração com senha conhecida (`admin123` e companhia). Rodá-lo contra
 * produção entrega um administrador completo de uma empresa-cliente a quem souber o padrão — e o
 * comando é vizinho do `db:migrate` no roteiro de deploy, então o erro é fácil de cometer.
 * Mesma postura de `env.ts` com o JWT_SECRET e de `assertTestDatabase` nos testes: recusar, não avisar.
 */
function assertNotProduction() {
  if (process.env.NODE_ENV !== 'production') return

  console.error('Seed recusado: NODE_ENV=production.')
  console.error('Este comando cria usuários de demonstração com senha conhecida e nunca deve rodar em produção.')
  console.error('Para criar o primeiro acesso de uma instalação real, use: npm run db:seed:platform')
  process.exit(1)
}

async function run() {
  assertNotProduction()
  console.log('Iniciando seed...')

  await db.transaction(async (tx) => {
    const [company] = await tx.insert(companies).values({ name: 'Empresa Demo' }).returning()

    const [adminHash, gerenteHash, operadorHash] = await Promise.all([
      bcrypt.hash('admin123', 10),
      bcrypt.hash('gerente123', 10),
      bcrypt.hash('operador123', 10),
    ])

    const [admin, gerente, operador] = await tx
      .insert(users)
      .values([
        {
          companyId: company.id,
          name: 'Administrador',
          email: 'admin@hortierp.com',
          passwordHash: adminHash,
          role: 'admin',
        },
        {
          companyId: company.id,
          name: 'Camila Ferreira',
          email: 'gerente@hortierp.com',
          passwordHash: gerenteHash,
          role: 'gerente',
        },
        {
          companyId: company.id,
          name: 'Bruno Alves',
          email: 'operador@hortierp.com',
          passwordHash: operadorHash,
          role: 'operador',
        },
      ])
      .returning()

    const categoryRows = await tx
      .insert(categories)
      .values([
        { companyId: company.id, name: 'Frutas', description: 'Frutas frescas e da estação', createdBy: admin.id },
        { companyId: company.id, name: 'Verduras', description: 'Folhosas e verduras em geral', createdBy: admin.id },
        { companyId: company.id, name: 'Legumes', description: 'Legumes frescos', createdBy: admin.id },
        {
          companyId: company.id,
          name: 'Grãos e Cereais',
          description: 'Arroz, feijão e grãos em geral',
          createdBy: admin.id,
        },
        {
          companyId: company.id,
          name: 'Laticínios e Ovos',
          description: 'Leite, queijos e ovos',
          createdBy: admin.id,
        },
        { companyId: company.id, name: 'Mercearia', description: 'Itens de mercearia em geral', createdBy: admin.id },
      ])
      .returning()

    const [categoryFrutas, categoryVerduras, categoryLegumes, categoryGraos, categoryLaticinios, categoryMercearia] =
      categoryRows

    const unitRows = await tx
      .insert(units)
      .values([
        { companyId: company.id, name: 'Quilograma', abbreviation: 'kg', createdBy: admin.id },
        { companyId: company.id, name: 'Unidade', abbreviation: 'un', createdBy: admin.id },
        { companyId: company.id, name: 'Dúzia', abbreviation: 'dz', createdBy: admin.id },
        { companyId: company.id, name: 'Caixa', abbreviation: 'cx', createdBy: admin.id },
        { companyId: company.id, name: 'Pacote', abbreviation: 'pct', createdBy: admin.id },
      ])
      .returning()

    const [unitKg, unitUn, unitDz, unitCx, unitPct] = unitRows

    const productDefs = [
      { category: categoryFrutas, unit: unitKg, name: 'Banana Prata', minStock: 15, cost: 3.2, sale: 5.9 },
      { category: categoryFrutas, unit: unitDz, name: 'Laranja Pera', minStock: 10, cost: 4.5, sale: 7.9 },
      { category: categoryFrutas, unit: unitKg, name: 'Maçã Gala', minStock: 12, cost: 5.8, sale: 9.9 },
      { category: categoryFrutas, unit: unitKg, name: 'Mamão Formosa', minStock: 8, cost: 3.9, sale: 6.9 },
      { category: categoryVerduras, unit: unitUn, name: 'Alface Crespa', minStock: 25, cost: 1.5, sale: 3.5 },
      { category: categoryVerduras, unit: unitUn, name: 'Couve Manteiga', minStock: 20, cost: 1.8, sale: 3.9 },
      { category: categoryVerduras, unit: unitUn, name: 'Rúcula', minStock: 15, cost: 1.6, sale: 3.5 },
      {
        category: categoryVerduras,
        unit: unitUn,
        name: 'Espinafre',
        minStock: 10,
        cost: 2.0,
        sale: 4.2,
        active: false,
      },
      { category: categoryLegumes, unit: unitKg, name: 'Batata Inglesa', minStock: 30, cost: 3.5, sale: 6.5 },
      { category: categoryLegumes, unit: unitKg, name: 'Cenoura', minStock: 20, cost: 3.0, sale: 5.5 },
      { category: categoryLegumes, unit: unitKg, name: 'Tomate Salada', minStock: 25, cost: 4.8, sale: 8.9 },
      { category: categoryLegumes, unit: unitKg, name: 'Cebola', minStock: 20, cost: 3.6, sale: 6.9 },
      { category: categoryGraos, unit: unitCx, name: 'Arroz Branco 5kg', minStock: 8, cost: 18.5, sale: 26.9 },
      { category: categoryGraos, unit: unitCx, name: 'Feijão Carioca 1kg', minStock: 15, cost: 6.2, sale: 9.9 },
      { category: categoryGraos, unit: unitPct, name: 'Aveia em Flocos 500g', minStock: 10, cost: 4.5, sale: 7.9 },
      { category: categoryGraos, unit: unitPct, name: 'Farinha de Trigo 1kg', minStock: 12, cost: 4.0, sale: 6.9 },
      { category: categoryLaticinios, unit: unitUn, name: 'Leite Integral 1L', minStock: 30, cost: 3.8, sale: 5.9 },
      { category: categoryLaticinios, unit: unitUn, name: 'Queijo Minas 500g', minStock: 10, cost: 12.5, sale: 19.9 },
      { category: categoryLaticinios, unit: unitDz, name: 'Ovos Brancos', minStock: 15, cost: 8.5, sale: 13.9 },
      { category: categoryLaticinios, unit: unitUn, name: 'Iogurte Natural', minStock: 20, cost: 3.2, sale: 5.5 },
      { category: categoryMercearia, unit: unitUn, name: 'Óleo de Soja 900ml', minStock: 12, cost: 6.5, sale: 9.9 },
      { category: categoryMercearia, unit: unitUn, name: 'Açúcar Cristal 1kg', minStock: 15, cost: 3.9, sale: 6.5 },
      { category: categoryMercearia, unit: unitUn, name: 'Café Torrado 500g', minStock: 10, cost: 9.8, sale: 15.9 },
      {
        category: categoryMercearia,
        unit: unitUn,
        name: 'Sal Refinado 1kg',
        minStock: 20,
        cost: 1.8,
        sale: 3.2,
        active: false,
      },
    ]

    const productRows = await tx
      .insert(products)
      .values(
        productDefs.map((def, index) => ({
          companyId: company.id,
          categoryId: def.category.id,
          unitId: def.unit.id,
          name: def.name,
          sku: `SKU-${String(index + 1).padStart(4, '0')}`,
          costPrice: def.cost.toFixed(2),
          salePrice: def.sale.toFixed(2),
          minStock: def.minStock.toString(),
          currentStock: '0',
          active: def.active ?? true,
          createdBy: admin.id,
        })),
      )
      .returning()

    const stock = new Map(productRows.map((product) => [product.id, 0]))

    const suppliers = [
      'CEASA Distribuidora',
      'Fazenda Bom Fruto',
      'Agropecuária Vale Verde',
      'Laticínios Serra Azul',
      'Atacadão Grãos & Cia',
    ]

    const lossReasons: LossReason[] = ['vencido', 'avariado', 'roubo_furto', 'erro_operacional', 'outro']
    const creators = [operador, operador, gerente, admin]

    type Event =
      | { kind: 'entry'; date: Date; supplierName: string; items: { productId: string; quantity: number }[] }
      | { kind: 'loss'; date: Date; productId: string; reason: LossReason; quantity: number }

    const events: Event[] = []

    const entryCount = 50
    for (let i = 0; i < entryCount; i++) {
      const dayOffset = Math.floor(Math.pow(Math.random(), 1.8) * 90)
      const itemCount = randomInt(1, 3)
      const chosenProducts = shuffle(productRows).slice(0, itemCount)
      events.push({
        kind: 'entry',
        date: dateDaysAgo(dayOffset),
        supplierName: randomItem(suppliers),
        items: chosenProducts.map((product) => ({ productId: product.id, quantity: randomInt(8, 35) })),
      })
    }

    const lossCount = 45
    for (let i = 0; i < lossCount; i++) {
      const dayOffset = Math.floor(Math.pow(Math.random(), 1.5) * 55)
      const product = randomItem(productRows)
      events.push({
        kind: 'loss',
        date: dateDaysAgo(dayOffset),
        productId: product.id,
        reason: randomItem(lossReasons),
        quantity: randomInt(5, 25),
      })
    }

    events.sort((a, b) => a.date.getTime() - b.date.getTime())

    let entriesCreated = 0
    let lossesCreated = 0
    let entryItemsCreated = 0

    for (const event of events) {
      const createdBy = randomItem(creators).id

      if (event.kind === 'entry') {
        const [entry] = await tx
          .insert(stockEntries)
          .values({
            companyId: company.id,
            supplierName: event.supplierName,
            entryDate: event.date,
            createdAt: event.date,
            updatedAt: event.date,
            createdBy,
          })
          .returning()

        for (const item of event.items) {
          const product = productRows.find((p) => p.id === item.productId)!
          const unitCost = Number(product.costPrice) * (0.9 + Math.random() * 0.2)

          await tx.insert(stockEntryItems).values({
            stockEntryId: entry.id,
            productId: item.productId,
            quantity: item.quantity.toString(),
            unitCost: unitCost.toFixed(2),
          })

          const newStock = (stock.get(item.productId) ?? 0) + item.quantity
          stock.set(item.productId, newStock)

          await tx.insert(stockMovements).values({
            companyId: company.id,
            productId: item.productId,
            type: 'entrada',
            quantity: item.quantity.toString(),
            balanceAfter: newStock.toString(),
            referenceType: 'stock_entry',
            referenceId: entry.id,
            createdAt: event.date,
            createdBy,
          })

          entryItemsCreated++
        }

        entriesCreated++
        continue
      }

      const currentStock = stock.get(event.productId) ?? 0
      const quantity = Math.min(event.quantity, Math.floor(currentStock * 0.8))
      if (quantity < 1) continue

      const [loss] = await tx
        .insert(losses)
        .values({
          companyId: company.id,
          productId: event.productId,
          quantity: quantity.toString(),
          reason: event.reason,
          notes: event.reason === 'outro' ? 'Detalhes registrados na conferência de estoque' : undefined,
          lossDate: event.date,
          createdAt: event.date,
          updatedAt: event.date,
          createdBy,
        })
        .returning()

      const newStock = currentStock - quantity
      stock.set(event.productId, newStock)

      await tx.insert(stockMovements).values({
        companyId: company.id,
        productId: event.productId,
        type: 'perda',
        quantity: (-quantity).toString(),
        balanceAfter: newStock.toString(),
        referenceType: 'loss',
        referenceId: loss.id,
        createdAt: event.date,
        createdBy,
      })

      lossesCreated++
    }

    const lowStockTargets = shuffle(productRows.filter((p) => p.active)).slice(0, 4)
    for (const product of lowStockTargets) {
      const minStockValue = Number(product.minStock)
      const currentStock = stock.get(product.id) ?? 0
      const target = Math.floor(minStockValue * (0.3 + Math.random() * 0.4))
      if (currentStock <= target) continue

      const quantity = currentStock - target
      const date = dateDaysAgo(randomInt(0, 4))
      const createdBy = randomItem(creators).id

      const [loss] = await tx
        .insert(losses)
        .values({
          companyId: company.id,
          productId: product.id,
          quantity: quantity.toString(),
          reason: randomItem(lossReasons),
          lossDate: date,
          createdAt: date,
          updatedAt: date,
          createdBy,
        })
        .returning()

      stock.set(product.id, target)

      await tx.insert(stockMovements).values({
        companyId: company.id,
        productId: product.id,
        type: 'perda',
        quantity: (-quantity).toString(),
        balanceAfter: target.toString(),
        referenceType: 'loss',
        referenceId: loss.id,
        createdAt: date,
        createdBy,
      })

      lossesCreated++
    }

    for (const product of productRows) {
      await tx
        .update(products)
        .set({ currentStock: (stock.get(product.id) ?? 0).toString() })
        .where(eq(products.id, product.id))
    }

    console.log(`Empresa: ${company.name}`)
    console.log(`Produtos: ${productRows.length}`)
    console.log(`Entradas de estoque: ${entriesCreated} (${entryItemsCreated} itens)`)
    console.log(`Perdas registradas: ${lossesCreated}`)
  })

  console.log('Seed concluído.')
  console.log('Logins de teste:')
  console.log('  Admin:    admin@hortierp.com / admin123')
  console.log('  Gerente:  gerente@hortierp.com / gerente123')
  console.log('  Operador: operador@hortierp.com / operador123')

}

// Escopo de plataforma: o seed cria as empresas, então não existe empresa de sessão ainda.
comEscopoDePlataforma(run)
  .catch((error) => {
    console.error('Falha ao rodar seed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => {})
  })
