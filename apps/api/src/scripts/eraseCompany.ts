import { pool } from '../db/client.js'
import { isPlatformCompany } from '../modules/companies/companies.service.js'
import { collectCompanyFootprint, eraseCompanyData } from '../modules/companies/erase-company.service.js'
import { comEscopoDePlataforma } from '../db/scope.js'

// Apaga em definitivo os dados de uma empresa. Sem tela de propósito — ver docs/deploy-producao.md.
//   node dist/scripts/eraseCompany.js --id=<uuid> --dry-run
//   node dist/scripts/eraseCompany.js --id=<uuid> --confirm="<nome exato da empresa>"

class UsageError extends Error {}

function readFlag(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

async function run() {
  const dryRun = process.argv.includes('--dry-run')
  const companyId = readFlag('id')
  const confirmation = readFlag('confirm')

  if (!companyId) throw new UsageError('Informe --id=<uuid da empresa>.')
  if (!confirmation && !dryRun) {
    throw new UsageError(
      'Informe --confirm="<nome exato da empresa>". Rode com --dry-run primeiro para ver o nome e os volumes.',
    )
  }

  const footprint = await collectCompanyFootprint(companyId)
  if (!footprint) throw new UsageError(`Nenhuma empresa com o id ${companyId}.`)

  const { company, volumes } = footprint

  if (await isPlatformCompany(company.id)) {
    throw new UsageError(
      'Recusado: esta é a empresa da plataforma. Apagá-la destruiria o próprio acesso de super admin.',
    )
  }

  console.log(`Empresa: ${company.name}${company.document ? ` (${company.document})` : ''}`)
  for (const [rotulo, total] of Object.entries(volumes)) {
    console.log(`  ${rotulo}: ${total}`)
  }

  if (dryRun) {
    console.log('\n[dry-run] Nada foi apagado.')
    console.log(`Para apagar de verdade: --id=${company.id} --confirm="${company.name}"`)
    return
  }

  if (confirmation !== company.name) {
    throw new UsageError(`Recusado: --confirm não corresponde. Esperado exatamente: "${company.name}"`)
  }

  const { removedFiles } = await eraseCompanyData(footprint)

  console.log(`\nEmpresa "${company.name}" apagada em definitivo.`)
  console.log(`${removedFiles} arquivo(s) de nota fiscal removido(s) do disco.`)
  console.log(
    'Atenção: os backups já criados seguem contendo estes dados até expirarem pela retenção do bucket.',
  )

}

comEscopoDePlataforma(run)
  .catch((error) => {
    console.error(error instanceof UsageError ? error.message : `Falha ao apagar a empresa: ${error}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => {})
  })
