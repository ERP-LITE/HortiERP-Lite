import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { comEscopoDePlataforma } from '../../db/scope.js'
import { companies, plans } from '../../db/schema/index.js'
import { AppError } from '../../shared/errors/AppError.js'
import { addDaysToIsoDate, daysBetweenIsoDates, todayIsoDate } from '../../shared/utils/date.js'
import { createCompanyWithAdmin } from '../companies/companies.service.js'
import type { PublicSignupInput } from '../companies/companies.schema.js'

export interface SituacaoDaAssinatura {
  status: 'teste' | 'ativa' | 'atrasada' | 'cancelada'
  /** Dias inteiros até o fim do teste. Zero é o último dia, negativo já passou. `null` fora do teste. */
  diasRestantes: number | null
  trialEndsOn: string | null
  bloqueada: boolean
}

export async function listActivePlans() {
  const linhas = await db
    .select({
      id: plans.id,
      name: plans.name,
      description: plans.description,
      monthlyAmount: plans.monthlyAmount,
      trialDays: plans.trialDays,
    })
    .from(plans)
    .where(and(eq(plans.active, true), isNull(plans.deletedAt)))
    .orderBy(asc(plans.monthlyAmount))

  return linhas
}

/** Sem ida ao banco: roda em toda requisição autenticada, e o `authenticate` já leu essas colunas. */
export function avaliarAssinatura(
  empresa: { subscriptionStatus: SituacaoDaAssinatura['status']; trialEndsOn: string | null },
  hoje = todayIsoDate(),
): SituacaoDaAssinatura {
  const { subscriptionStatus: status, trialEndsOn } = empresa

  if (status !== 'teste') {
    return { status, diasRestantes: null, trialEndsOn, bloqueada: status === 'cancelada' }
  }

  // Sem data não bloqueia: barrar alguém por causa de coluna vazia é pior do que um dia a mais.
  if (!trialEndsOn) return { status, diasRestantes: null, trialEndsOn, bloqueada: false }

  const diasRestantes = daysBetweenIsoDates(hoje, trialEndsOn)
  return { status, diasRestantes, trialEndsOn, bloqueada: diasRestantes < 0 }
}

export async function getCompanySubscription(companyId: string) {
  const [linha] = await db
    .select({
      subscriptionStatus: companies.subscriptionStatus,
      trialEndsOn: companies.trialEndsOn,
      planName: plans.name,
      monthlyAmount: plans.monthlyAmount,
    })
    .from(companies)
    .leftJoin(plans, eq(plans.id, companies.planId))
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1)

  if (!linha) throw AppError.notFound('Empresa não encontrada')

  return {
    ...avaliarAssinatura(linha),
    planName: linha.planName,
    monthlyAmount: linha.monthlyAmount,
  }
}

/**
 * Único ponto do sistema alcançável **sem autenticação** que escreve com o isolamento por empresa
 * desligado. Por isso ela só insere: nunca leia nem devolva registro de outra empresa daqui.
 */
export async function signUpCompany(data: PublicSignupInput) {
  return comEscopoDePlataforma(async () => {
    const [plano] = await db
      .select({ id: plans.id, trialDays: plans.trialDays })
      .from(plans)
      .where(and(eq(plans.id, data.planId), eq(plans.active, true), isNull(plans.deletedAt)))
      .limit(1)

    if (!plano) throw AppError.notFound('Plano não encontrado ou fora de uso')

    const { company, admin } = await createCompanyWithAdmin(data, {
      planId: plano.id,
      // O dia do cadastro conta como o primeiro, então 15 dias terminam no 14º dia depois de hoje.
      trialEndsOn: addDaysToIsoDate(todayIsoDate(), plano.trialDays - 1),
      privacyAcceptedAt: new Date(),
    })

    return {
      company: { id: company.id, name: company.name },
      admin: { name: admin.name, email: admin.email },
      trialEndsOn: company.trialEndsOn,
    }
  })
}
