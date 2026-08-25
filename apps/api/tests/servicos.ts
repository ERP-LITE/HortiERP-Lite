import { comEscopoDaEmpresa } from '../src/db/scope.js'
import { createLoss as criarPerdaReal } from '../src/modules/losses/losses.service.js'
import { createStockEntry as criarEntradaReal } from '../src/modules/stock-entries/stock-entries.service.js'

// Alguns testes chamam o serviço direto, fora de requisição, onde não existe escopo. Estes invólucros
// abrem o que o hook abriria, com o mesmo nome e assinatura.
export const createStockEntry: typeof criarEntradaReal = (companyId, userId, data) =>
  comEscopoDaEmpresa(companyId, () => criarEntradaReal(companyId, userId, data))

export const createLoss: typeof criarPerdaReal = (companyId, userId, data) =>
  comEscopoDaEmpresa(companyId, () => criarPerdaReal(companyId, userId, data))
