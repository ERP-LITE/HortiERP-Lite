/**
 * Aparência do campo com erro, num lugar só.
 *
 * **Os dois `!` são obrigatórios.** Sem eles o vermelho some no modo escuro em silêncio:
 * `dark:border-gray-600` e `focus:ring-primary-500` vencem por especificidade, e o campo fica
 * vermelho no tema claro e não no escuro, ou vermelho com halo verde em volta ao receber foco.
 */
export const CLASSE_CAMPO_COM_ERRO = '!border-red-500 ring-1 ring-red-500/40 focus:!ring-red-500'
