# Fluxos de negócio

Todos os fluxos abaixo são escopados por `companyId` (ver [decisões arquiteturais](./decisoes-arquiteturais.md)) — descritos aqui do ponto de vista de dentro de uma única empresa.

## Cadastro básico

Pré-requisito dos fluxos de estoque: **categoria** e **unidade de medida** existem independentes de produto (telas `/categorias` e `/unidades`); um **produto** exige uma categoria e uma unidade já cadastradas (`categoryId`/`unitId` validados como pertencentes à mesma empresa na criação/edição — `assertCategoryAndUnitBelongToCompany`). `currentStock` do produto nasce em `0` e só é alterado pelos fluxos de entrada/perda abaixo — nunca é editado diretamente pela tela de produto.

As listagens de categorias, unidades, produtos e usuários permitem selecionar os registros visíveis por checkbox e excluí-los em lote. A exclusão é lógica e auditada; está disponível para `admin` e `gerente` nos cadastros gerais e somente para `admin` em usuários. Históricos operacionais (entradas, perdas e movimentações) não oferecem exclusão.

## Entrada de mercadoria

Tela `/entradas` → `/entradas/nova`. Rota `POST /stock-entries`, service `stock-entries.service.ts::createStockEntry`. Qualquer usuário autenticado pode registrar (sem restrição de papel — ver decisões arquiteturais).

Uma entrada tem um cabeçalho (`stock_entries`: fornecedor em texto livre, data, observações) e uma lista de itens (`stock_entry_items`: produto + quantidade + custo unitário opcional). Tudo roda numa única transação:

1. Cria a linha em `stock_entries`.
2. Para cada item: valida que o produto existe na empresa, insere a linha em `stock_entry_items`, soma a quantidade ao `currentStock` do produto, e grava um `stock_movements` com `type: 'entrada'`, quantidade positiva e `balanceAfter` = novo saldo.

Se qualquer produto do lote não existir, a transação inteira é revertida (nenhum item é gravado, nenhum estoque é alterado).

## Registro de perda

Tela `/perdas`. Rota `POST /losses`, service `losses.service.ts::createLoss`. Mesma liberação de papel que entradas.

1. Busca o produto e o `currentStock` atual.
2. **Valida que a quantidade da perda não é maior que o estoque disponível** — se for, rejeita com `422 INSUFFICIENT_STOCK` antes de gravar qualquer coisa.
3. Insere a linha em `losses` (motivo: `vencido` / `avariado` / `roubo_furto` / `erro_operacional` / `outro`).
4. Subtrai a quantidade do `currentStock` do produto.
5. Grava um `stock_movements` com `type: 'perda'`, **quantidade negativa** e `balanceAfter` = novo saldo.

Tudo em uma transação — perda só é registrada se o estoque puder de fato ser decrementado.

## Consulta de estoque

Tela `/estoque` (`GET /stock`): lista produtos ativos com estoque atual, com filtro "só estoque baixo" (`currentStock <= minStock`, comparação feita no banco). Tela `/estoque/movimentacoes` (`GET /stock/movements`): histórico completo e imutável de todo `stock_movements` gerado pelos dois fluxos acima, filtrável por produto/tipo/período.

Não existe ainda fluxo de **ajuste manual de estoque** (contagem/inventário) — o tipo `ajuste` já existe no enum de movimentação e no filtro da listagem, reservado para essa futura tela.

## Dashboard

`GET /dashboard/summary` agrega, para o período selecionado: total de produtos ativos, quantidade com estoque baixo, valor de estoque (soma de `currentStock * costPrice`), contagem/quantidade de perdas no período, timeline diária de entradas × perdas, distribuição de estoque por categoria e de perdas por motivo, e as 10 movimentações mais recentes dentro do mesmo período. O card de movimentações exibe explicitamente o intervalo aplicado.

## Logs

- Tela `/logs/atividades`: somente o `admin` consulta ações de escrita realizadas dentro da própria empresa. O `companyId` não é aceito da interface; é obtido obrigatoriamente da sessão.
- Tela `/logs/tecnicos`: somente o `super_admin`, fora do modo de impersonação, consulta requisições de toda a plataforma, identifica a empresa responsável e filtra por empresa, método, nível e período.
- Os dois históricos são somente leitura e paginados.

## Cadastro de empresas-cliente e acesso como suporte

Fluxo exclusivo do papel `super_admin` (dono da plataforma, não de nenhum cliente) — mecanismo completo descrito em [decisões arquiteturais](./decisoes-arquiteturais.md#empresa-da-plataforma-e-super_admin).

1. Login do `super_admin` cai em `/selecionar-empresa`: lista todas as empresas-cliente (ativas clicáveis, suspensas desabilitadas) + um item pra "Configurações gerais do sistema" (`/empresas`).
2. Em `/empresas`, cadastra uma nova empresa-cliente junto com o primeiro usuário admin dela numa única transação (`POST /companies`), edita nome/documento, e ativa/suspende o acesso (`PATCH /companies/:id/active` — suspender bloqueia login de todos os usuários daquela empresa imediatamente).
3. Clicar numa empresa ativa em `/selecionar-empresa` "entra" nela (`POST /companies/:id/impersonate`): passa a ver e editar os dados daquela empresa com permissão de admin, mantendo seu próprio nome/e-mail de super_admin.
4. Uma faixa fixa no topo avisa que está em modo suporte, com botão pra voltar ao próprio perfil de super_admin sem logout (`POST /auth/exit-impersonation`).
