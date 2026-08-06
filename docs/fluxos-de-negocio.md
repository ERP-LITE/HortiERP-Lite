# Fluxos de negócio

Todos os fluxos abaixo são escopados por `companyId` (ver [decisões arquiteturais](./decisoes-arquiteturais.md)) — descritos aqui do ponto de vista de dentro de uma única empresa.

## Cadastro básico

Pré-requisito dos fluxos de estoque: **categoria** e **unidade de medida** existem independentes de produto (telas `/categorias` e `/unidades`); um **produto** exige uma categoria e uma unidade já cadastradas (`categoryId`/`unitId` validados como pertencentes à mesma empresa na criação/edição — `assertCategoryAndUnitBelongToCompany`). `currentStock` do produto nasce em `0` e só é alterado pelos fluxos de entrada, perda e ajuste manual abaixo — nunca é editado diretamente pela tela de produto.

As listagens de categorias, unidades, produtos e usuários permitem selecionar os registros visíveis por checkbox e excluí-los em lote. A exclusão é lógica e auditada; está disponível para `admin` e `gerente` nos cadastros gerais e somente para `admin` em usuários. Históricos operacionais (entradas, perdas e movimentações) não oferecem exclusão.

## Entrada de mercadoria

Tela `/entradas` → `/entradas/nova`. Rota `POST /stock-entries`, service `stock-entries.service.ts::createStockEntry`. Qualquer usuário autenticado pode registrar (sem restrição de papel — ver decisões arquiteturais).

Uma entrada tem um cabeçalho (`stock_entries`: fornecedor em texto livre, data, observações), dados opcionais de nota fiscal (número, série, chave de acesso, emissão e valor total), anexos privados e uma lista de itens (`stock_entry_items`: produto + quantidade + custo unitário opcional). O registro da entrada e a atualização do estoque rodam numa única transação:

1. Cria a linha em `stock_entries`.
2. Para cada item: chama o helper compartilhado `applyStockMovement`, que soma a quantidade ao `currentStock` com um `UPDATE` atômico escopado por empresa, valida pelo retorno que o produto existe e grava um `stock_movements` com `type: 'entrada'`, quantidade positiva e `balanceAfter` = novo saldo retornado pelo banco; em seguida insere a linha em `stock_entry_items`.

Se qualquer produto do lote não existir, a transação inteira é revertida (nenhum item é gravado, nenhum estoque é alterado).
O histórico e o relatório de entradas exibem o nome do usuário de `createdBy` como **Recebido por**, mantendo identificável quem recebeu a mercadoria.

Depois de criar a entrada, a interface envia até 3 anexos pelos endpoints `/stock-entries/:id/attachments`. São aceitos XML, PDF, JPG, PNG e WEBP, com limite padrão de 10 MB por arquivo. Os arquivos não ficam em pasta pública: a API grava nomes aleatórios no volume privado configurado por `INVOICE_STORAGE_PATH`, enquanto `stock_entry_attachments` mantém nome original, MIME type, tamanho e autoria. Todo acesso valida o `companyId` da sessão; imagens e PDFs podem ser pré-visualizados, e XML é entregue somente como download. A assinatura do conteúdo é conferida para impedir que apenas a extensão/MIME seja falsificada. A listagem permite pesquisar também pelo número ou pela chave de acesso da nota. Administradores e gerentes podem excluir anexos definitivamente; operadores podem enviar, visualizar e baixar, mas não excluir. Uploads simultâneos da mesma entrada são serializados no banco para preservar o limite de 3 arquivos.

Se um upload falhar depois do registro da entrada, o lançamento de estoque permanece válido e a tela de detalhes permite adicionar novamente o anexo ausente. Essa separação evita manter uma transação de banco aberta durante transferência de arquivo.

Administradores e gerentes podem corrigir posteriormente fornecedor, observações e os dados fiscais da entrada. Produtos, quantidades e custos permanecem imutáveis nesse fluxo para não alterar retroativamente o estoque; uma correção de quantidades deve ser feita pelo fluxo auditável de ajuste de estoque.

## Registro de perda

Tela `/perdas`. Rota `POST /losses`, service `losses.service.ts::createLoss`. Mesma liberação de papel que entradas.

1. Pelo helper compartilhado `applyStockMovement`, **subtrai e valida o saldo numa única atualização atômica** (`currentStock >= quantidade`). A condição é reavaliada pelo PostgreSQL mesmo quando existem perdas simultâneas.
2. Se o produto não existir, rejeita com `404`; se existir mas não houver saldo suficiente, rejeita com `422 INSUFFICIENT_STOCK`.
3. Insere a linha em `losses` (motivo: `vencido` / `avariado` / `roubo_furto` / `erro_operacional` / `outro`).
4. Grava um `stock_movements` com `type: 'perda'`, **quantidade negativa** e `balanceAfter` = novo saldo retornado pelo banco.

Tudo em uma transação — perda só é registrada se o estoque puder de fato ser decrementado.
O histórico e o relatório de perdas exibem o nome do usuário de `createdBy` como **Registrado por**.

## Consulta de estoque

Tela `/estoque` (`GET /stock`): lista produtos não excluídos, ativos ou inativos, com estoque atual e filtro "só estoque baixo" (`currentStock <= minStock`, comparação feita no banco). Tela `/estoque/movimentacoes` (`GET /stock/movements`): histórico completo e imutável de todo `stock_movements` gerado pelos três fluxos abaixo, filtrável por produto/tipo/período. Cada movimento inclui o nome público do usuário de `createdBy`; a interface o exibe na coluna **Usuário** e usa “Usuário não identificado” para registros antigos sem autor.

## Ajuste manual de estoque

Tela `/estoque`. Rota `POST /stock/adjust`, service `stock.service.ts::createStockAdjustment`. Exige `admin` ou `gerente` — ao contrário de entrada/perda, não é uma operação do dia a dia do estoquista, e sim uma correção que sobrescreve o saldo calculado pelo sistema sem passar pelas validações de fornecedor/motivo dos outros fluxos, então fica no mesmo padrão de permissão dos módulos de cadastro (ver decisões arquiteturais).

Dois pontos de entrada, mesmo endpoint por baixo:

- **Correção pontual**: botão de editar (ícone de lápis) ou duplo clique numa linha da tabela — abre o modal já preenchido com aquele produto e o estoque atual.
- **Ajuste em lote**: botão "Ajuste em lote" no cabeçalho da tela — abre um formulário com N linhas (produto + nova quantidade), no mesmo padrão de "adicionar/remover item" usado em entrada de mercadoria. Pensado para depois de uma contagem física completa, quando vários produtos precisam de correção de uma vez com o mesmo motivo.

Em ambos os casos o usuário informa a **nova quantidade absoluta** por produto e um motivo obrigatório único para o lote inteiro (ex: "contagem física apontou divergência"). O modal exibe um aviso deixando claro que esse caminho é só para corrigir divergências de contagem/inventário — entradas e perdas continuam sendo lançadas pelas telas próprias.

O payload sempre é `{ notes, items: [{ productId, quantity }] }` — a correção pontual só envia `items` com 1 elemento. Processamento, numa única transação:

1. Para cada item, lê o `currentStock` atual do produto com lock de linha (`SELECT ... FOR UPDATE`); se o produto não existe (ou é de outra empresa), rejeita o lote inteiro com `404`.
2. Itens cuja quantidade informada é igual à atual são **pulados silenciosamente** (sem gerar movimento) — numa contagem de vários produtos é normal que alguns já estejam certos, e isso não deveria travar o resto do lote.
3. Para cada item com diferença real, chama `applyStockMovement`, que atualiza `products.currentStock` e grava um `stock_movements` com `type: 'ajuste'`, `quantity` = diferença (novo − antigo, pode ser positiva ou negativa) e `balanceAfter` = novo saldo. O motivo informado é salvo na coluna `notes` do movimento (mesmo texto em todos os movimentos do lote) e aparece no histórico de movimentações junto do usuário responsável.
4. Se **nenhum** item do lote tinha diferença (todos pulados), rejeita com `422` — o lote inteiro não fez sentido, não só um item.

## Dashboard

`GET /dashboard/summary` agrega, para o período selecionado: total de produtos ativos, quantidade com estoque baixo, valor de estoque (soma de `currentStock * costPrice`), contagem/quantidade de perdas no período, timeline diária de entradas × perdas, distribuição do estoque **ativo** por categoria e de perdas por motivo, e as 10 movimentações mais recentes dentro do mesmo período. O card de movimentações exibe explicitamente o intervalo aplicado. Produtos inativos não entram nos totais nem na distribuição por categoria.

Contagens, somas e agrupamentos são calculados no PostgreSQL; produtos e perdas completos não são carregados em memória apenas para produzir os totais. Categorias excluídas logicamente não participam dos agrupamentos.

## Relatórios

Os detalhamentos de perdas e entradas são paginados e pesquisados no backend, mantendo os agregados por motivo sobre todo o período selecionado. Isso evita respostas sem limite conforme o histórico da empresa cresce.

A tela apresenta indicadores-resumo antes dos detalhamentos e permite gerar cada relatório em PDF pelo diálogo de impressão do navegador. Para perdas e entradas, a geração busca todas as páginas do período e da pesquisa aplicados antes de montar o documento; a paginação permanece apenas na visualização normal da tela. O documento inclui título, período, data de emissão e usuário responsável pela emissão.

## Apresentação de textos extensos

Nas tabelas e cartões, campos variáveis que podem receber conteúdo extenso — nomes, e-mails, descrições, observações, motivos, fornecedores, itens e contexto técnico de logs — usam o componente compartilhado `ExpandableText`. Textos curtos são exibidos normalmente; textos acima do limite mostram uma prévia truncada e um pequeno chevron para expandir/recolher o conteúdo dentro da própria célula. Sequências sem espaços usam quebra forçada para não alargar a tabela. Na impressão, o conteúdo completo é exibido.

Datas, números, status, perfis, badges e ações não usam esse comportamento porque possuem tamanho previsível. No mobile, esse controle de conteúdo convive com o accordion de linha das tabelas (`v-mobile-accordion`), sem substituir a navegação por campos do registro.

## Logs

- Tela `/logs/atividades`: somente o `admin` consulta ações de escrita realizadas dentro da própria empresa. O `companyId` não é aceito da interface; é obtido obrigatoriamente da sessão.
- Tela `/logs/tecnicos`: somente o `super_admin`, fora do modo de impersonação, consulta requisições de toda a plataforma, identifica a empresa responsável e filtra por empresa, método, nível e período.
- Os dois históricos são somente leitura e paginados.

## Cadastro de empresas-cliente e acesso como suporte

Fluxo exclusivo do papel `super_admin` (dono da plataforma, não de nenhum cliente) — mecanismo completo descrito em [decisões arquiteturais](./decisoes-arquiteturais.md#empresa-da-plataforma-e-super_admin).

1. Login do `super_admin` cai em `/selecionar-empresa`: lista todas as empresas-cliente (ativas clicáveis, suspensas desabilitadas) + um item pra "Configurações gerais do sistema" (`/empresas`).
2. Em `/empresas`, cadastra uma nova empresa-cliente junto com o primeiro usuário admin dela numa única transação (`POST /companies`), edita nome/documento, ativa/suspende o acesso (`PATCH /companies/:id/active` — suspender bloqueia login de todos os usuários daquela empresa imediatamente) e gerencia os demais usuários `super_admin` da plataforma (`/platform-users`). A própria conta autenticada não pode ser excluída.
3. Clicar numa empresa ativa em `/selecionar-empresa` "entra" nela (`POST /companies/:id/impersonate`): passa a ver e editar os dados daquela empresa com permissão de admin, mantendo seu próprio nome/e-mail de super_admin.
4. Uma faixa fixa no topo avisa que está em modo suporte, com botão pra voltar ao próprio perfil de super_admin sem logout (`POST /auth/exit-impersonation`).
