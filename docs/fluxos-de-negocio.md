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

A ordem das etapas do upload é deliberada: a transferência e a validação do conteúdo acontecem **fora** de qualquer transação, e só depois abre-se uma transação curta com `pg_advisory_xact_lock` para reconferir a contagem e inserir o registro. Fazer a gravação dentro da transação faria um cliente lento segurar uma conexão do pool e o lock da entrada durante toda a transferência — poucos envios simultâneos de 10 MB bastariam para travar a API inteira. Antes de aceitar os bytes há ainda uma contagem sem lock, só para recusar cedo uma entrada que já está cheia; a contagem que vale é a de dentro da transação. Se qualquer etapa falhar, o arquivo já gravado é removido do disco.

A rota de upload tem rate limit próprio de **10 requisições por minuto**, bem abaixo do teto global de 300: cada chamada aqui pode gravar até `INVOICE_MAX_FILE_SIZE` em disco, e o limite global permitiria encher o volume em poucos minutos. Anexar nota é uma ação manual, então o teto baixo não atrapalha o uso real.

Sobra um caso que nenhuma dessas proteções cobre: se a API cair entre a gravação do arquivo e o insert, o arquivo fica no disco sem dono, e nada no fluxo normal o remove. O comando `npm run invoices:cleanup` varre o diretório, compara com `stock_entry_attachments` e apaga o que não tem registro há mais de 24 horas (a carência protege uploads em andamento). Aceita `--dry-run`. Vale agendar mensalmente em produção — sem isso os restos só acumulam, ocupando volume e entrando nos backups criptografados junto com os anexos legítimos.

Se um upload falhar depois do registro da entrada, o lançamento de estoque permanece válido e a tela de detalhes permite adicionar novamente o anexo ausente. Essa separação evita manter uma transação de banco aberta durante transferência de arquivo.

Administradores e gerentes podem corrigir posteriormente fornecedor, observações e os dados fiscais da entrada. Produtos, quantidades e custos permanecem imutáveis nesse fluxo para não alterar retroativamente o estoque; uma correção de quantidades deve ser feita pelo fluxo auditável de ajuste de estoque.

## Registro de perda

Tela `/perdas`. Rota `POST /losses`, service `losses.service.ts::createLoss`. Mesma liberação de papel que entradas.

1. Pelo helper compartilhado `applyStockMovement`, **subtrai e valida o saldo numa única atualização atômica** (`currentStock >= quantidade`). A condição é reavaliada pelo PostgreSQL mesmo quando existem perdas simultâneas.
2. Se o produto não existir, rejeita com `404`; se existir mas não houver saldo suficiente, rejeita com `422 INSUFFICIENT_STOCK`.
3. Insere a linha em `losses` (motivo: `vencido` / `avariado` / `roubo_furto` / `erro_operacional` / `outro`), congelando em `unitCost` o `costPrice` que o produto tem naquele momento — assim o valor perdido do passado não muda quando o custo do produto é reajustado depois.
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

`GET /dashboard/summary` agrega, para o período selecionado: total de produtos ativos, quantidade com estoque baixo, valor de estoque (soma de `currentStock * costPrice`), valor perdido no período, timeline diária de entradas × perdas × ajustes, distribuição dos produtos **ativos** por categoria e de perdas por motivo, e as 10 movimentações mais recentes dentro do mesmo período. O card de movimentações exibe explicitamente o intervalo aplicado. Produtos inativos não entram nos totais nem na distribuição por categoria.

**Quantidades nunca são somadas entre unidades de medida diferentes.** Somar 3 kg com 2 caixas não significa nada, então cada agrupamento devolve `totalsByUnit` — um total por unidade — em vez de um número único. Por consequência, os gráficos que precisam de um valor escalar por fatia usam grandezas que somam entre unidades: o gráfico de categorias plota **quantidade de produtos** (por isso se chama "Produtos por categoria", não "Estoque por categoria") e o de perdas plota **quantidade de registros**; as quantidades por unidade aparecem no tooltip.

O valor perdido usa `losses.unitCost`, o custo congelado no momento em que a perda foi registrada. Perdas anteriores a essa coluna têm `unitCost` nulo e caem no `costPrice` atual do produto — nesses registros históricos, reajustar o custo de um produto move o valor perdido do passado.

Cada agrupamento também traz um detalhamento por produto, limitado aos maiores em quantidade (`TOP_PRODUCTS_PER_GROUP`, hoje 5) mais um `otherProductsCount` com quantos ficaram de fora. O endpoint não é paginado e o tooltip só exibe alguns itens: sem esse corte, um período de 90 dias com centenas de produtos girando produzia dezenas de milhares de objetos num único JSON que a tela nunca chegava a mostrar.

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
2. Em `/empresas`, cadastra uma nova empresa-cliente junto com o primeiro usuário admin dela numa única transação (`POST /companies`). Para manter o modal compacto, a criação é dividida em três abas: **Dados gerais** (identificação e contato), **Endereço** e **Administrador da empresa**; na edição aparecem somente as duas primeiras, pois usuários são gerenciados separadamente. Cada aba combina ícone e texto no desktop e mantém apenas o ícone no mobile, com rótulo acessível e tooltip. Ao completar oito dígitos no CEP, a interface tenta preencher o endereço por BrasilAPI, ViaCEP e OpenCEP, nessa ordem, com timeout individual e fallback automático; os campos permanecem editáveis e uma resposta atrasada de um CEP anterior é ignorada. O cadastro reúne nome fantasia, razão social, CNPJ, inscrição estadual opcional, responsável, e-mail, telefone e endereço completo. CNPJ, telefone e CEP são normalizados; o CNPJ passa pela validação dos dígitos verificadores e não pode se repetir entre empresas não excluídas. Na mesma tela o `super_admin` edita esses dados, ativa/suspende o acesso (`PATCH /companies/:id/active` — suspender bloqueia login de todos os usuários daquela empresa imediatamente) e gerencia os demais usuários `super_admin` da plataforma (`/platform-users`). A própria conta autenticada não pode ser excluída.
3. Clicar numa empresa ativa em `/selecionar-empresa` "entra" nela (`POST /companies/:id/impersonate`): passa a ver e editar os dados daquela empresa com permissão de admin, mantendo seu próprio nome/e-mail de super_admin.
4. Uma faixa fixa no topo avisa que está em modo suporte, com botão pra voltar ao próprio perfil de super_admin sem logout (`POST /auth/exit-impersonation`).

## Controle manual de cobranças

Tela `/cobrancas`, exclusiva do `super_admin` fora do modo de impersonação. O módulo é um controle administrativo
interno e não possui checkout, assinatura automática, emissão de boleto ou integração com gateway de pagamento.

Cada registro vincula uma empresa-cliente a uma competência mensal e guarda vencimento, valor previsto, observações
e, quando recebido, valor e data do pagamento. Uma empresa não pode ter duas cobranças da mesma competência. A
listagem permite pesquisar por empresa e, pelo modal de filtros compartilhado do sistema, filtrar o vencimento por
período e pelos estados `pago`, `pendente` e `atrasado`; o estado é calculado pela API com base na data de pagamento
e no vencimento. Datas do filtro e dos formulários são apresentadas no padrão brasileiro `dd/mm/aaaa`; a competência
usa seletores próprios de mês em português e ano, sem depender do seletor nativo do navegador.

As rotas `GET/POST/PUT/DELETE /billings` exigem o papel `super_admin`. Marcar como pago exige data e valor pagos em
conjunto; desmarcar limpa ambos. O sistema não suspende automaticamente uma empresa inadimplente: eventual suspensão
continua sendo uma decisão manual na gestão de empresas.

Diferente dos cadastros (produtos, categorias, unidades, usuários), excluir uma cobrança apaga a linha de verdade:
o registro é digitado à mão pelo próprio `super_admin` e a exclusão serve pra corrigir um lançamento errado, não pra
"arquivar" um histórico. Manter a linha escondida por `deleted_at` também travaria o índice único da competência, que
impediria relançar o mesmo mês depois de apagar o engano.
