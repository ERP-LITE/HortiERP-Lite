import bcrypt from 'bcryptjs'
import { db, pool } from './client.js'
import { categories, companies, products, units, users } from './schema/index.js'

async function run() {
  console.log('Iniciando seed...')

  const [company] = await db
    .insert(companies)
    .values({ name: 'Empresa Demo' })
    .returning()

  const passwordHash = await bcrypt.hash('admin123', 10)

  const [admin] = await db
    .insert(users)
    .values({
      companyId: company.id,
      name: 'Administrador',
      email: 'admin@hortierp.com',
      passwordHash,
      role: 'admin',
    })
    .returning()

  const [categoryFrutas, categoryVerduras, categoryLegumes, categoryMercearia] = await db
    .insert(categories)
    .values([
      { companyId: company.id, name: 'Frutas', createdBy: admin.id },
      { companyId: company.id, name: 'Verduras', createdBy: admin.id },
      { companyId: company.id, name: 'Legumes', createdBy: admin.id },
      { companyId: company.id, name: 'Mercearia', createdBy: admin.id },
    ])
    .returning()

  const [unitKg, unitUn, unitDz, unitCx] = await db
    .insert(units)
    .values([
      { companyId: company.id, name: 'Quilograma', abbreviation: 'kg', createdBy: admin.id },
      { companyId: company.id, name: 'Unidade', abbreviation: 'un', createdBy: admin.id },
      { companyId: company.id, name: 'Dúzia', abbreviation: 'dz', createdBy: admin.id },
      { companyId: company.id, name: 'Caixa', abbreviation: 'cx', createdBy: admin.id },
    ])
    .returning()

  await db.insert(products).values([
    {
      companyId: company.id,
      categoryId: categoryFrutas.id,
      unitId: unitKg.id,
      name: 'Banana Prata',
      minStock: '10',
      currentStock: '0',
      createdBy: admin.id,
    },
    {
      companyId: company.id,
      categoryId: categoryFrutas.id,
      unitId: unitDz.id,
      name: 'Laranja Pera',
      minStock: '15',
      currentStock: '0',
      createdBy: admin.id,
    },
    {
      companyId: company.id,
      categoryId: categoryVerduras.id,
      unitId: unitUn.id,
      name: 'Alface Crespa',
      minStock: '20',
      currentStock: '0',
      createdBy: admin.id,
    },
    {
      companyId: company.id,
      categoryId: categoryLegumes.id,
      unitId: unitKg.id,
      name: 'Batata Inglesa',
      minStock: '30',
      currentStock: '0',
      createdBy: admin.id,
    },
    {
      companyId: company.id,
      categoryId: categoryMercearia.id,
      unitId: unitCx.id,
      name: 'Arroz Branco 5kg',
      minStock: '5',
      currentStock: '0',
      createdBy: admin.id,
    },
  ])

  console.log('Seed concluído.')
  console.log('Login de teste: admin@hortierp.com / admin123')

  await pool.end()
}

run().catch((error) => {
  console.error('Falha ao rodar seed:', error)
  process.exit(1)
})
