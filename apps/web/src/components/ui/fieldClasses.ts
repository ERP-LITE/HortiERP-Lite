/**
 * Aparência do campo com erro, num lugar só. `BaseInput`, `BaseSelect` e `DateInput` apontam para
 * cá, então mudar o vermelho é mudar uma linha, e nenhum campo fica para trás.
 *
 * **O `!` não é preguiça, é obrigatório.** Sem ele o vermelho some no modo escuro, e some em
 * silêncio: a borda padrão é `dark:border-gray-600`, que o Tailwind gera como
 * `.dark\:border-gray-600:is(.dark *)`. Isso vale duas classes de especificidade contra uma de
 * `.border-red-400`, e ainda sai depois no arquivo, então ganha duas vezes. O resultado era o pior
 * possível: no tema claro o campo ficava vermelho, no escuro não, e nada acusava a diferença.
 *
 * O anel acompanha a borda porque 1px de borda passa despercebido em tela de celular no depósito,
 * que é onde o erro mais precisa ser visto.
 *
 * `focus:!ring-red-500` existe porque o anel de foco é verde (`focus:ring-primary-500`) e vence o
 * anel vermelho por especificidade. Sem essa linha, clicar num campo com erro dava borda vermelha
 * com halo verde em volta, duas cores dizendo coisas opostas no mesmo campo. Campo com erro fica
 * vermelho inteiro, focado ou não; o foco muda a intensidade do anel, não a cor.
 */
export const CLASSE_CAMPO_COM_ERRO = '!border-red-500 ring-1 ring-red-500/40 focus:!ring-red-500'
