import { comEscopoDaEmpresa } from '../src/db/scope.js'
import { createLoss as criarPerdaReal } from '../src/modules/losses/losses.service.js'
import { createStockEntry as criarEntradaReal } from '../src/modules/stock-entries/stock-entries.service.js'

/**
 * Alguns testes chamam o serviço direto, sem passar pela rota — e é fora de requisição que não existe
 * escopo, então as políticas por empresa recusariam. Estes invólucros abrem o escopo que o hook abriria,
 * mantendo o mesmo nome e a mesma assinatura para as chamadas do teste não mudarem.
 */
export const createStockEntry: typeof criarEntradaReal = (companyId, userId, data) =>
  comEscopoDaEmpresa(companyId, () => criarEntradaReal(companyId, userId, data))

export const createLoss: typeof criarPerdaReal = (companyId, userId, data) =>
  comEscopoDaEmpresa(companyId, () => criarPerdaReal(companyId, userId, data))
