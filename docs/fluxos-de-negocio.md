# Fluxos de negócio

Todos os fluxos abaixo são escopados por `companyId` (ver [decisões arquiteturais](./decisoes-arquiteturais.md)) — descritos aqui do ponto de vista de dentro de uma única empresa.

## Cadastro básico

Pré-requisito dos fluxos de estoque: **categoria** e **unidade de medida** existem independentes de produto (telas `/categorias` e `/unidades`); um **produto** exige uma categoria e uma unidade já cadastradas (`categoryId`/`unitId` validados como pertencentes à mesma empresa e ativos na criação/edição, por `assertCategoryAndUnitUsable`). `currentStock` do produto nasce em `0` e só é alterado pelos fluxos de entrada, perda e ajuste manual abaixo — nunca é editado diretamente pela tela de produto.

Categoria e unidade têm situação **ativa/inativa**: inativa continua valendo para os produtos que já usam, sai das opções de produto novo e as duas telas filtram por situação. A listagem de produtos filtra por categoria, **unidade** e situação. Excluir categoria ou unidade em uso é recusado com `409`, e a mensagem oferece as duas saídas: trocar o cadastro dos produtos, ou apenas inativar.

As listagens de categorias, unidades, produtos e usuários permitem selecionar os registros visíveis por checkbox e excluí-los em lote. A exclusão é lógica e auditada; está disponível para `admin` e `gerente` nos cadastros gerais e somente para `admin` em usuários. Históricos operacionais (entradas, perdas e movimentações) não oferecem exclusão.

Todo campo de texto tem teto de caracteres e todo campo numérico tem teto de valor, definidos em `shared/schemas/limits.ts` e espelhados na tela em `lib/limits.ts` (ver [decisões arquiteturais](./decisoes-arquiteturais.md#limites-de-tamanho-dos-campos)). Na prática: nome de cadastro vai até 120 caracteres, razão social, e-mail, endereço e busca até 160, descrição até 300, observação de perda até 500, observação de entrada até 2000, abreviação de unidade até 10, quantidade até 999.999,999 e preço unitário até 9.999.999,99. As listas também têm teto: 200 itens por entrada de mercadoria e 100 por ajuste em lote, para uma requisição forjada não abrir milhares de linhas numa transação. O campo para de aceitar digitação ao chegar no limite; quem tentar passar por fora da tela recebe `422` com a mensagem em português apontando o campo.

Os campos opcionais do produto (SKU, código de barras, custo e preço de venda) podem ser **apagados** depois de preenchidos: a tela envia `null` e a API grava vazio. Omitir a chave no payload continua significando "não mexe neste campo", o que mantém atualizações parciais possíveis pela API. Campo em branco é normalizado para `null` em vez de `''` — dois produtos sem SKU guardando string vazia colidiriam no índice único parcial, que só ignora nulos, e a tela receberia um 409 dizendo que o SKU já existe.

**Margem alvo e preço sugerido.** Categoria e produto têm um campo de margem alvo, em percentual sobre o preço de venda. A do produto manda; em branco, vale a da categoria. A partir dela a API devolve, em cada consulta de produto, quatro campos calculados e não guardados: `currentMargin` (a margem que o preço praticado hoje entrega), `effectiveTargetMargin` (a que valeu, própria ou herdada), `targetMarginInherited` (de onde ela veio) e `suggestedPrice` (`custo / (1 - margem / 100)`). A tela de Produtos ganhou a coluna **Margem**, que mostra a margem praticada, pinta de vermelho o prejuízo e de âmbar quem está abaixo do alvo, e imprime embaixo o preço sugerido quando ele difere do praticado em mais de um centavo. A planilha exportada leva as três colunas novas. A importação por planilha **não** traz margem alvo: produto importado herda a da categoria. Margem é sempre sobre a venda, nunca markup, e o porquê está em [decisoes-arquiteturais.md](./decisoes-arquiteturais.md#margem-alvo-em-dois-níveis-e-sempre-sobre-a-venda).

O e-mail do usuário é a identidade de login e não depende de maiúsculas: ele é gravado em minúsculas e quem entra pode digitar como quiser. Excluir um usuário **libera** o e-mail dele, então recontratar a mesma pessoa depois usa o mesmo endereço normalmente — o excluído continua sem conseguir entrar. Detalhes em [modelo de dados](./modelo-de-dados.md#users).

Nenhum `admin` consegue rebaixar o próprio perfil de acesso nem desativar a própria conta (`409`); alterar **outros** usuários segue liberado. Sem essa trava a empresa podia ficar com zero admins ativos, e aí só um `super_admin` em impersonação conseguiria devolver o acesso à gestão de usuários. É a mesma proteção que já impedia excluir a própria conta.

## Importação de produtos por planilha

Tela `/produtos`. Rota `POST /products/import`, service `products.service.ts::importProducts`. Exige `admin` ou
`gerente`, como os demais cadastros. O frontend lê o arquivo (`lib/productSpreadsheet.ts`) e envia as linhas já como
JSON — a API nunca recebe o arquivo em si. Máximo de 2000 linhas por vez.

**A operação é tudo-ou-nada.** Se qualquer linha estiver inválida, nada é gravado. Importar só as linhas boas
obrigaria o usuário a corrigir o arquivo e reenviar, e aí as linhas já importadas voltariam como duplicadas; corrigir
o arquivo inteiro de uma vez é o caminho mais previsível. Com `dryRun`, a mesma validação roda sem gravar nada — é o
que a tela usa para mostrar a prévia antes de confirmar.

Os erros voltam por número de linha, limitados a 200 por resposta; `omittedErrors` conta quantos ficaram de fora para
a tela não fingir que a lista está completa.

**A conferência vale também quando não há erro.** A resposta traz `preview`: uma linha por produto aceito, com o valor
já convertido, a categoria e a unidade como vão ficar, o estoque inicial e as marcas `newCategory`/`newUnit`. Sem isso
a tela só mostrava contadores quando a planilha estava certa, e quem importa 300 produtos confirmava sem ver o que ia
entrar. A lista vem da API, e não do arquivo lido no navegador, porque é a API que sabe o que vai fazer com cada linha:
o número já interpretado, a categoria que ainda não existe, a unidade encontrada pela abreviação. Mesmo limite de 200
dos erros, com `omittedPreview` no mesmo papel de `omittedErrors`.

Como cada campo é interpretado:

| Campo | Regra |
|---|---|
| `name` | obrigatório; recusado se repetir outro produto **do arquivo** ou já existente, ignorando maiúsculas |
| `categoryName` | obrigatório; precisa existir, salvo com `createMissingRefs`; categoria inativa é reaproveitada, não duplicada |
| `unitName` | obrigatório; aceita o **nome** ou a **abreviação** da unidade, porque quem preenche a planilha escreve "kg", não "Quilograma"; unidade inativa é reaproveitada, e a conferência marca a linha |
| `sku` | opcional; único quando informado, na mesma comparação sem maiúsculas |
| `costPrice`, `salePrice`, `minStock`, `currentStock` | aceitam o formato brasileiro (`1.234,56`) e o americano (`1234.56`) — o separador decimal é o último que aparecer, e o outro é tratado como separador de milhar. Planilha exportada do Excel em português usa vírgula, mas quem digita à mão mistura os dois |
| `active` | `sim`/`s`/`true`/`verdadeiro`/`1`/`ativo` e `nao`/`não`/`n`/`false`/`falso`/`0`/`inativo`; vazio vira ativo |

Com `createMissingRefs`, as categorias e unidades que faltavam são criadas na mesma transação. A unidade nova precisa
de uma abreviação única: ela é derivada do nome (10 primeiros caracteres) e desempatada com sufixo numérico quando já
existe outra igual.

**O estoque informado na planilha nasce junto com o produto e também vira uma movimentação de `ajuste`**
(`referenceType: 'import'`), para que a primeira linha do histórico explique de onde veio o saldo e o gráfico de
entradas × perdas do painel feche com o estoque atual. Como o produto está sendo criado naquela transação e ninguém
mais o enxerga, o saldo é gravado direto na linha em vez de passar por `applyStockMovement` — somar a um saldo que é
zero dá o mesmo resultado, sem duas consultas por produto (numa planilha cheia, eram milhares de idas ao banco).

O resumo devolvido inclui `withInitialStock` e `initialStockWithoutCost`. O segundo é um aviso: quantidade sem custo
entra no estoque valendo zero, e o painel mostraria a loja cheia com "valor em estoque: R$ 0,00". Não impede a
importação, mas o usuário precisa ver isso antes de confirmar.

A importação aceita dois modos. Por padrão, planilha com qualquer linha inválida não grava nada. Com `skipInvalid: true`, a API importa as linhas válidas e devolve as recusadas em `errors`, o que atende a planilha grande em que parte das linhas está errada: a tela oferece isso como **Importar as N válidas** e mantém a janela aberta depois, com a lista do que ficou de fora. Nesse modo, categoria e unidade novas só são criadas se alguma linha **aceita** as usa, senão uma linha recusada deixaria para trás um cadastro sem nenhum produto. A lista de erros é baixada no formato da própria planilha modelo, com uma coluna de motivo no fim, para ser corrigida e reenviada sozinha: reenviar o arquivo inteiro traria o que já entrou como nome duplicado.

## Entrada de mercadoria

Tela `/entradas` → `/entradas/nova`. Rota `POST /stock-entries`, service `stock-entries.service.ts::createStockEntry`. Qualquer usuário autenticado pode registrar (sem restrição de papel — ver decisões arquiteturais).

Uma entrada tem um cabeçalho (`stock_entries`: fornecedor em texto livre, data da entrada, observações), dados opcionais de nota fiscal (número, série, chave de acesso, emissão e valor total), anexos privados e uma lista de itens (`stock_entry_items`: produto + quantidade + custo unitário opcional). O registro da entrada e a atualização do estoque rodam numa única transação:

1. Cria a linha em `stock_entries`.
2. Para cada item: chama o helper compartilhado `applyStockMovement`, que soma a quantidade ao `currentStock` com um `UPDATE` atômico escopado por empresa, valida pelo retorno que o produto existe e grava um `stock_movements` com `type: 'entrada'`, quantidade positiva e `balanceAfter` = novo saldo retornado pelo banco; em seguida insere a linha em `stock_entry_items`.

Se qualquer produto do lote não existir, a transação inteira é revertida (nenhum item é gravado, nenhum estoque é alterado).
O histórico e o relatório de entradas exibem o nome do usuário de `createdBy` como **Recebido por**, mantendo identificável quem recebeu a mercadoria.

### Começar pelo XML da nota

Rota `POST /stock-entries/nfe`, leitor em `nfe.ts` (interpreta o arquivo) e `nfe.service.ts` (casa com o cadastro). **A rota não grava nada**: devolve a nota lida com cada item já ligado ao produto quando dá, e a entrada continua nascendo pelo `POST /stock-entries` de sempre.

O que a tela preenche a partir do arquivo: fornecedor, CNPJ do emitente, número, série, chave de acesso, data de emissão, valor total e a lista de itens com quantidade e custo unitário. A **data da entrada não é tocada**: a nota diz quando foi emitida, não quando a mercadoria chegou. O próprio XML entra na lista de anexos, para não ser enviado duas vezes.

O casamento de cada item tem duas camadas, nesta ordem: o `cEAN` da nota contra `products.barcode`, e depois o de para de `supplier_product_codes` para aquele CNPJ emitente. Item sem correspondência volta em branco e a tela mostra o que a nota dizia (`Na nota: TOMATE ITALIANO · KG`) junto de um aviso para escolher o produto. Ao confirmar a entrada, `aprenderVinculos` grava o que foi escolhido com `ON CONFLICT DO UPDATE`, e a nota seguinte daquele fornecedor já vem ligada. Entrada sem CNPJ de emitente não cria vínculo, porque o código sozinho não identifica nada.

Duas recusas deliberadas no casamento: **código de barras repetido em dois produtos não casa com nenhum** (`products.barcode` não é único, então não há resposta certa) e **arquivo com DOCTYPE é recusado antes de ser interpretado**, porque NF-e não usa DOCTYPE e é por ali que passa a expansão de entidades.

A área tracejada de escolher arquivo virou `FilePickerArea` (`components/ui`), usada pelo bloco do XML e pelo de anexos: ela centraliza o estilo e a limpeza do `input.value`, sem a qual escolher o mesmo arquivo duas vezes seguidas não dispara evento nenhum. A faixa do importador de planilha não foi unificada com ela: é um botão em linha, com outra borda e outro espaçamento. A seleção de anexos passou a **somar** em vez de substituir, com botão de remover por arquivo. Antes, escolher um segundo arquivo descartava o primeiro sem avisar, o que ficou perigoso quando o XML lido passou a entrar sozinho na lista. A junção **não corta no teto de 3 anexos**: cortar ali faria o arquivo que não coube sumir calado, porque o aviso de limite só aparece quando a lista passa do teto. A lista cresce, o aviso aparece e o salvamento trava até a pessoa remover um arquivo.

**Uma entrada guarda uma nota só** (número, série e chave são um valor cada), então ler um segundo XML troca a lista de itens em vez de somar. O teto de 3 anexos é de arquivos **da mesma nota** (XML, DANFE em PDF, foto do canhoto), e não de três notas numa entrada; o texto da tela passou a dizer isso com todas as letras porque "até 3 arquivos" era lido como "até 3 notas". Quando já existe item preenchido na tela, a troca pede confirmação por `confirmAction`, senão quem tivesse ligado os itens à mão perderia o trabalho sem entender o motivo. `confirmDelete` passou a ser um atalho para esse mesmo `confirmAction`, com o botão vermelho de excluir.

O porquê de cada uma dessas escolhas, incluindo por que não existe tela de de para e as três armadilhas de leitura de XML, está em [decisoes-arquiteturais.md](./decisoes-arquiteturais.md#leitura-do-xml-da-nota-duas-camadas-para-casar-o-produto).

Depois de criar a entrada, a interface envia até 3 anexos pelos endpoints `/stock-entries/:id/attachments`. São aceitos XML, PDF, JPG, PNG e WEBP, com limite padrão de 10 MB por arquivo. Os arquivos não ficam em pasta pública: a API grava nomes aleatórios no volume privado configurado por `INVOICE_STORAGE_PATH`, enquanto `stock_entry_attachments` mantém nome original, MIME type, tamanho e autoria. Todo acesso valida o `companyId` da sessão; imagens e PDFs podem ser pré-visualizados, e XML é entregue somente como download. A assinatura do conteúdo é conferida para impedir que apenas a extensão/MIME seja falsificada. A tabela de formatos aceitos é um `Map`, e não um objeto literal: o MIME type vem do cabeçalho enviado pelo cliente, e num objeto comum uma busca por chave herdada (`constructor`, `__proto__`) devolveria valor do prototype em vez de `undefined`, deixando passar um formato que não está na lista. A listagem permite pesquisar também pelo número ou pela chave de acesso da nota. Administradores e gerentes podem excluir anexos definitivamente; operadores podem enviar, visualizar e baixar, mas não excluir. Uploads simultâneos da mesma entrada são serializados no banco para preservar o limite de 3 arquivos.

A ordem das etapas do upload é deliberada: a transferência e a validação do conteúdo acontecem **fora** de qualquer transação, e só depois abre-se uma transação curta com `pg_advisory_xact_lock` para reconferir a contagem e inserir o registro. Fazer a gravação dentro da transação faria um cliente lento segurar o lock da entrada durante toda a transferência — poucos envios simultâneos de 10 MB bastariam para travar a API inteira. (O argumento da conexão do pool, que este parágrafo trazia antes, deixou de valer com o RLS: hoje toda requisição reserva uma conexão do início ao fim. O que a transação curta protege é o lock.) Antes de aceitar os bytes há ainda uma contagem sem lock, só para recusar cedo uma entrada que já está cheia; a contagem que vale é a de dentro da transação. Se qualquer etapa falhar, o arquivo já gravado é removido do disco.

A rota de upload tem rate limit próprio de **10 requisições por minuto**, bem abaixo do teto global de 300: cada chamada aqui pode gravar até `INVOICE_MAX_FILE_SIZE` em disco, e o limite global permitiria encher o volume em poucos minutos. Anexar nota é uma ação manual, então o teto baixo não atrapalha o uso real.

**Pré-visualização no celular.** O arquivo é sempre buscado por `fetch` autenticado e transformado em `blob:` — nunca é apontado direto pela `src` de uma tag, porque a URL da API exige o cookie de sessão. Imagem é exibida por `<img>` e funciona em qualquer tela. PDF, porém, só é exibido em `<iframe>` **no desktop**: nenhum navegador de celular renderiza PDF dentro de iframe (o Chrome do Android não tem visualizador embutido para esse caso e o Safari do iOS mostra em branco), então a pré-visualização abria vazia no mobile. Abaixo do breakpoint `sm` a tela oferece **Abrir no aparelho** — um `window.open` no blob já carregado, entregando o arquivo ao visualizador nativo — e **Baixar**. O clique tem que ser um gesto novo do usuário: disparar o `window.open` logo após o `await` do download cairia no bloqueio de pop-up. O desktop segue exatamente como era.

Como o blob é criado a partir dos bytes em memória, os cabeçalhos da resposta (`Content-Disposition`, `Content-Security-Policy`, `nosniff`) não interferem na exibição — eles valem para o acesso direto à URL da API, e é por isso que continuam sendo testados no contrato de entrega.

Sobra um caso que nenhuma dessas proteções cobre: se a API cair entre a gravação do arquivo e o insert, o arquivo fica no disco sem dono, e nada no fluxo normal o remove. O comando `npm run invoices:cleanup` varre o diretório, compara com `stock_entry_attachments` e apaga o que não tem registro há mais de 24 horas (a carência protege uploads em andamento). Aceita `--dry-run`. Vale agendar mensalmente em produção — sem isso os restos só acumulam, ocupando volume e entrando nos backups criptografados junto com os anexos legítimos.

A tela recusa o envio antes de criar a entrada quando a seleção já está inválida (mais de 3 arquivos ou algum acima do limite): o aviso nomeia o arquivo e os dois tamanhos, e o botão de salvar não passa. Sem isso a entrada era gravada com os dados da nota preenchidos e sem anexo nenhum, e a listagem exibia "Com nota". A coluna **Nota fiscal** da listagem distingue três situações: **Anexada** quando existe arquivo, **Sem arquivo** quando os dados da nota estão preenchidos mas nenhum arquivo foi enviado, e **Sem nota** quando não há nem dado nem arquivo. Ordenar por essa coluna agrupa primeiro o que falta resolver.

Se um upload falhar depois do registro da entrada, o lançamento de estoque permanece válido e a tela de detalhes permite adicionar novamente o anexo ausente. Essa separação evita manter uma transação de banco aberta durante transferência de arquivo.

Administradores e gerentes podem corrigir posteriormente fornecedor, observações e os dados fiscais da entrada. Produtos, quantidades e custos permanecem imutáveis nesse fluxo para não alterar retroativamente o estoque; uma correção de quantidades deve ser feita pelo fluxo auditável de ajuste de estoque.

### Data do lançamento

A tela traz **a data de hoje preenchida** e o usuário pode trocá-la antes de salvar. Existe para o caso comum de a
mercadoria ter chegado ontem e o lançamento só sair no dia seguinte — sem isso, o registro nasceria com a data errada e
a única correção possível seria o ajuste manual de estoque.

Os limites, iguais em entrada e perda (`shared/schemas/eventDate.schema.ts`):

- **Data futura é recusada.** Não se recebe mercadoria que ainda não chegou, nem se perde o que ainda não existe.
- **Retroatividade vai até `MAX_BACKDATE_DAYS` (hoje 365 dias).** O teto não protege contra fraude — quem pode lançar
  pode escolher qualquer dia dentro da janela; ele protege contra o erro de digitação de ano, que jogaria o lançamento
  para um período que ninguém mais audita.
- **Data impossível é recusada** em vez de virar outro dia. `2026-02-31` não é normalizada para março.
- O calendário da tela desabilita os dias fora da faixa (`min`/`max` do `DateInput`), então o caminho normal nem chega
  a mandar data inválida. A validação da API continua valendo por si.

**Qual instante é gravado.** A tela manda apenas a data civil. Quando é hoje, guarda-se o instante real do lançamento,
para o histórico de movimentações manter a hora; quando é retroativa, guarda-se o início daquele dia no fuso do
negócio, porque a hora verdadeira do fato é desconhecida e inventá-la seria pior.

**A data escolhida também vale para a movimentação de estoque** (`movementDate`), e é isso que mantém a tela de
Entradas, o histórico de movimentações e o gráfico do painel contando a mesma coisa. Ver
[modelo de dados](./modelo-de-dados.md#stock_movements). No histórico, uma movimentação cuja data do fato cai em dia
diferente do lançamento aparece com **"Lançado em …"** — sem essa marca não haveria como distinguir o que aconteceu do
que foi digitado depois.

O que **não** tem data informada: o ajuste manual de estoque (é uma correção de contagem, feita no dia em que se
conta), o estorno de perda cancelada (o estorno acontece hoje, mesmo que a perda seja antiga) e a carga inicial por
planilha. Nesses casos a data da movimentação é o próprio instante do lançamento.

## Registro de perda

Tela `/perdas`. Rota `POST /losses`, service `losses.service.ts::createLoss`. Mesma liberação de papel que entradas.

A data segue exatamente a mesma regra da entrada (ver [Data do lançamento](#data-do-lançamento)): vem preenchida com
hoje, aceita retroatividade dentro da janela e recusa futuro. O que a perda **não** aceita é mudar a data depois de
registrada — corrigir só alcança motivo e observações.

1. Pelo helper compartilhado `applyStockMovement`, **subtrai e valida o saldo numa única atualização atômica** (`currentStock >= quantidade`). A condição é reavaliada pelo PostgreSQL mesmo quando existem perdas simultâneas.
2. Se o produto não existir, rejeita com `404`; se existir mas não houver saldo suficiente, rejeita com `422 INSUFFICIENT_STOCK`.
3. Insere a linha em `losses` (motivo: `vencido` / `avariado` / `roubo_furto` / `erro_operacional` / `outro`), congelando em `unitCost` o `costPrice` que o produto tem naquele momento — assim o valor perdido do passado não muda quando o custo do produto é reajustado depois.
4. Grava um `stock_movements` com `type: 'perda'`, **quantidade negativa** e `balanceAfter` = novo saldo retornado pelo banco.

Tudo em uma transação — perda só é registrada se o estoque puder de fato ser decrementado.
O histórico e o relatório de perdas exibem o nome do usuário de `createdBy` como **Registrado por**.

### Corrigir uma perda lançada errado

Duas saídas, conforme o que está errado. Ambas exigem `admin` ou `gerente` — registrar continua liberado a qualquer
papel, corrigir e cancelar não.

**Correção (`PATCH /losses/:id`)** — só **motivo** e **observações**. Produto, quantidade e data ficam imutáveis, pelo
mesmo motivo das entradas de mercadoria: alterá-los mudaria o estoque retroativamente, e mexer na data moveria o
registro entre períodos já conferidos. A tela mostra produto, quantidade e data como leitura no modal de correção, com
a orientação de cancelar quando um deles é que está errado. Perda já cancelada não aceita mais correção (`409`).

A correção abre pelo ícone de lápis ou por **duplo clique na linha**, como nos demais cadastros. Linha de perda
cancelada não responde ao duplo clique e não exibe os ícones — a API recusaria a alteração de todo modo, e abrir o
modal para depois falhar seria pior que não abrir.

**Cancelamento (`POST /losses/:id/cancel`)** — é o caminho para erro de produto ou de quantidade, justamente o que a
correção não cobre. Exige um motivo do cancelamento e, numa única transação:

1. Marca `cancelledAt`, `cancelledBy` e `cancelReason` na perda. **Nada é apagado** — o registro continua consultável.
2. Devolve a quantidade ao estoque como `stock_movements` de `type: 'ajuste'` e `referenceType: 'loss_cancellation'`,
   então o histórico explica de onde veio o saldo de volta. A perda original permanece no histórico: ficam as duas
   linhas, e é isso que se quer auditar. O estorno vale **mesmo que o produto tenha sido excluído** depois do
   lançamento (`allowDeletedProduct` em `applyStockMovement`): a linha do produto continua existindo com seu saldo, e
   recusar por causa da exclusão deixaria o usuário sem como tirar a perda dos relatórios. Registrar operação **nova**
   em produto excluído continua bloqueado — a permissão existe só para estorno.
3. Registra a ação `cancelou` na auditoria de negócio, com quem cancelou, o motivo e a quantidade estornada.

Depois de cancelar, o lançamento correto é feito como uma perda nova. Devolver estoque é sempre seguro (é incremento,
nunca deixa saldo negativo), diferente do que aconteceria ao estornar uma entrada de mercadoria — por isso o
cancelamento existe para perdas e não para entradas.

Cancelar duas vezes responde `409`, e um `select ... for update` na linha da perda serializa cliques simultâneos: o
estoque é devolvido uma única vez mesmo com várias requisições concorrentes.

**Onde a perda cancelada deixa de contar:** relatório de perdas (inclusive os agregados por motivo) e todos os
indicadores do dashboard — valor perdido, contagem e distribuição por motivo. Ela também sai da listagem `/perdas` por
padrão; o filtro "Mostrar perdas canceladas" a traz de volta, exibida com badge **Cancelada**, quantidade riscada e o
motivo do cancelamento no lugar das observações. No CSV a coluna **Situacao** distingue as duas, e o valor perdido de
uma cancelada sai em branco para não ser somado por engano na planilha.

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

## Contagem de estoque

Telas `/contagem` (histórico e abertura) e `/contagem/:id` (a sessão). Módulo `apps/api/src/modules/stock-counts/`.

O ajuste manual acima conserta o produto que alguém já sabe estar errado. A contagem faz a pergunta inversa: **o que está errado e ninguém sabe?** É ela que revela a quebra que ninguém registrou, aquela que não passa pela tela de perdas porque caiu no chão, foi mal pesada na balança ou sumiu.

### As quatro etapas

`em_andamento` → `em_conferencia` → `concluida`, com `cancelada` alcançável das duas primeiras. Reabrir (`em_conferencia` → `em_andamento`) é permitido para quem quiser recontar um produto antes de aplicar.

1. **Abrir** (`POST /stock-counts`, `admin`/`gerente`): recebe `categoryId` opcional e `notes`. Junta todos os produtos ativos e não excluídos (da categoria, se informada) em `stock_count_items`, um por produto, sem quantidade. Recusa com `409` se já houver contagem aberta e com `422` se o filtro não alcançar nenhum produto ativo.
2. **Contar** (`PATCH /stock-counts/:id/items/:productId`, **sem papel exigido**): grava a quantidade de um produto e devolve só ela. Aceita `null`, que apaga o lançamento e devolve o produto para a fila de pendentes. Recusa com `422` se a contagem não estiver mais `em_andamento`.
3. **Conferir** (`POST /stock-counts/:id/review`, `admin`/`gerente`): exige ao menos um produto contado (`422` se nenhum) e passa para `em_conferencia`, que é o momento em que o saldo e a divergência aparecem. **Nada é gravado no estoque aqui.**
4. **Encerrar** (`POST /stock-counts/:id/finish`, `admin`/`gerente`) ou **cancelar** (`POST /stock-counts/:id/cancel`, com motivo obrigatório).

### A contagem é cega, e isso é a regra central

Enquanto o status é `em_andamento`, a API devolve `previousQuantity`, `unitCost`, `difference` e `differenceValue` sempre nulos, e o resumo vem com divergência e valores zerados. Não é a tela que esconde: o dado não sai do servidor.

O motivo é operacional, não técnico. Quem vê "18" escrito na tela bate o olho na banca, acha que parece uns 18 e digita 18, e aí a contagem só confirmou o erro que ela existia para achar. O campo vazio obriga a contar de verdade.

Pela mesma razão, o filtro `situacao=divergentes` é recusado com `422` (`COUNT_STILL_BLIND`) numa contagem ainda cega: ele apontaria, produto a produto, exatamente o que esconder o saldo evita entregar.

### O que acontece no encerramento

Tudo numa transação, em `finishStockCount`:

1. Trava a contagem (`SELECT ... FOR UPDATE`) e recusa com `422` se ela não estiver em conferência: encerrar duas vezes não aplica o ajuste de novo.
2. Lê os itens contados **já travando as linhas de `products`** (`FOR UPDATE OF products`). A trava vem antes do congelamento de propósito: sem ela, uma entrada lançada no meio faria o relatório mostrar uma diferença e o estoque receber outra.
3. Congela `previousQuantity` e `unitCost` de todos os itens contados, inclusive dos que bateram, com o saldo e o custo daquele instante.
4. Para cada item, `delta = contado − saldo atual`. Diferença zero não gera movimento. O resto vai para `applyStockMovement` com `type: 'ajuste'`, `referenceType: 'stock_count'` e `referenceId` da contagem, ou seja: o ajuste da contagem aparece no mesmo histórico de movimentações que o ajuste manual, rastreável até a contagem que o gerou.
5. Marca `concluida` e grava `finishedAt`.

Produto **não contado** não recebe ajuste nenhum e aparece no relatório sem saldo, sem diferença e sem valor. Produto excluído no meio da contagem fica de fora do congelamento e do ajuste, pelo mesmo caminho.

A expressão de referência muda com a etapa (`referenciaDaContagem`): **em conferência** é `coalesce(previousQuantity, products.currentStock)`, porque a referência ainda não foi congelada e o saldo de agora é o que o ajuste vai corrigir; **encerrada ou cancelada** é só a coluna congelada. Sem essa separação, um relatório de meses atrás mostraria o estoque de hoje na coluna "Sistema tinha", e o produto que ninguém contou apareceria conferido.

Cancelar também congela a referência, sem aplicar movimento: o relatório da contagem cancelada precisa continuar mostrando a divergência que existia quando alguém decidiu não seguir com ela.

**Custo medido** (loja sintética de 3000 produtos, contagem com 3000 itens e 2600 contados): as telas ficam todas abaixo de 8 ms (lista de itens 5 ms, resumo 4 ms, histórico 4 ms). O encerramento é o passo caro, porque `applyStockMovement` faz uma ida ao banco por produto ajustado: 64 ms para 68 ajustes, 163 ms para 220, 419 ms para 735 e 1,2 s para 1925, ou seja cerca de 0,55 ms por produto corrigido. Uma frutaria típica, de 100 a 300 produtos, encerra em menos de 200 ms. O laço não foi trocado por gravação em bloco de propósito: a economia só apareceria na loja de milhares de produtos, e o preço seria duplicar a regra de `applyStockMovement`, por onde passa toda movimentação de estoque do sistema. Se um cliente chegar nessa escala, é aqui que se mexe.

### O relatório

`GET /stock-counts/:id` devolve o cabeçalho, `revelada` e o resumo (`itemsCount`, `countedCount`, `pendingCount`, `divergentCount`, `positiveValue`, `negativeValue`, `netValue`). `GET /stock-counts/:id/items` devolve os produtos paginados, com busca por nome e o filtro `situacao`.

Sobra e falta são separadas em vez de aparecerem só como saldo, e a falta vem já positiva para a tela não precisar inverter o sinal. Na tela, falta é vermelho e **sobra é âmbar, não verde**: achar mais do que o sistema tinha também é sinal de lançamento errado, não de lucro.

O cálculo mora em `divergencia.ts`, fora do serviço, e é testado sozinho. O arredondamento é explícito (3 casas na quantidade, 2 no dinheiro) porque sem ele `0,1 + 0,2` vira divergência falsa. O resumo é somado na aplicação, e não por agregação no banco: uma versão em SQL economizaria a leitura das linhas da contagem, mas deixaria a regra arredondando em dois lugares, e o que está coberto por teste é o de cá.

### Na tela

Contando, cada produto é um cartão com campo próprio, e não uma linha de tabela: a pessoa está em pé no meio da loja com o celular numa mão. Cada quantidade sobe sozinha, 700 ms depois da última tecla ou ao sair do campo, com aviso de "Salvando", "Salvo" e um botão de tentar de novo quando falha. É isso que permite bloquear a tela, perder o sinal no fundo da loja ou parar para almoçar sem perder o que já foi digitado.

A barra de progresso é atualizada localmente a cada lançamento em vez de recarregar o resumo: ela precisa andar a cada produto, e buscar o resumo inteiro a cada tecla seria requisição à toa dentro da loja.

Conferida, a mesma tela vira relatório: quatro cartões de totais e a tabela comparando sistema, contado, diferença e valor, com o mesmo acordeão de celular das outras listagens.

## Dashboard

`GET /dashboard/summary` agrega, para o período selecionado: total de produtos ativos, quantidade com estoque baixo, valor de estoque (soma de `currentStock * costPrice`), valor perdido no período, quebra em percentual (`shrinkage`), timeline diária de entradas × perdas × ajustes, distribuição dos produtos **ativos** por categoria e de perdas por motivo, e as 10 movimentações mais recentes dentro do mesmo período. O card de movimentações exibe explicitamente o intervalo aplicado. Produtos inativos não entram nos totais nem na distribuição por categoria.

Os cinco blocos da tela usam o mesmo `DashboardPanel` (casca, título e subtítulo opcional, com espaço para uma etiqueta à direita); o corpo fica por conta de cada um, porque uns levam gráfico com `p-4`, outros uma tabela sem recuo. A barra do card de quebra **não** foi unificada com a de `LossesByReasonChart`: aquela é interativa, com foco, `aria-label` por motivo e balão ao passar o mouse, e esta é estática com marcador de meta. Um componente que atendesse as duas precisaria repassar eventos e atributos para dentro, o que troca duplicação de classe por indireção em dois lugares só.

O bloco `shrinkage` divide o valor perdido pelo custo das entradas do mesmo período (`stock_entry_items.quantity * unit_cost`, caindo em `products.cost_price` quando o item não trouxe custo). Sem entrada no período o divisor é zero e `percent` vem `null`, nunca `0`. O `targetPercent` é a constante `META_DE_QUEBRA`, fixa em 5. O porquê do divisor e da meta está em [decisoes-arquiteturais.md](./decisoes-arquiteturais.md#quebra-em-percentual-o-divisor-é-o-que-entrou-não-a-venda). Perda cancelada sai da conta pela mesma condição que já a tirava dos outros indicadores, e `lossesByReason` passou a trazer `lossValue` por motivo.

**Quantidades nunca são somadas entre unidades de medida diferentes.** Somar 3 kg com 2 caixas não significa nada, então cada agrupamento devolve `totalsByUnit` — um total por unidade — em vez de um número único. Por consequência, os gráficos que precisam de um valor escalar por fatia usam grandezas que somam entre unidades: o gráfico de categorias plota **quantidade de produtos** (por isso se chama "Produtos por categoria", não "Estoque por categoria") e o de perdas plota **quantidade de registros**; as quantidades por unidade aparecem no tooltip.

O valor perdido usa `losses.unitCost`, o custo congelado no momento em que a perda foi registrada. Perdas anteriores a essa coluna têm `unitCost` nulo e caem no `costPrice` atual do produto — nesses registros históricos, reajustar o custo de um produto move o valor perdido do passado.

Cada agrupamento também traz um detalhamento por produto, limitado aos maiores em quantidade (`TOP_PRODUCTS_PER_GROUP`, hoje 5) mais um `otherProductsCount` com quantos ficaram de fora. O endpoint não é paginado e o tooltip só exibe alguns itens: sem esse corte, um período de 90 dias com centenas de produtos girando produzia dezenas de milhares de objetos num único JSON que a tela nunca chegava a mostrar.

**O corte acontece no PostgreSQL, não em JavaScript.** Cada agrupamento sai de duas consultas: uma agregada, sem a dimensão de produto (limitada por dia × tipo × unidade, ou por motivo × unidade, ou por categoria × unidade), que produz as contagens e os `totalsByUnit`; e uma de detalhe que numera os produtos com `row_number()` por agrupamento e devolve só os cinco primeiros. A sobra vem de um `count(distinct)` na consulta agregada. Antes as duas coisas saíam de uma consulta só, agrupada por produto e sem limite: o corte reduzia a **resposta**, mas o banco continuava devolvendo uma linha por produto por dia — dezenas de milhares de linhas para exibir cinco. O `row_number()` usa o nome do produto como critério de desempate, para a ordem não variar entre execuções quando duas quantidades empatam.

Contagens, somas e agrupamentos são calculados no PostgreSQL; produtos e perdas completos não são carregados em memória apenas para produzir os totais. Categorias excluídas logicamente não participam dos agrupamentos.

Na distribuição por categoria, um produto **sem saldo** conta no `productCount` da categoria mas não entra nos `totalsByUnit` nem no detalhamento: ele é um produto cadastrado ali, mas não tem quantidade para exibir. Categoria em que nenhum produto tem saldo devolve `totalsByUnit` vazio, em vez de uma linha com zero — exibir "0 kg" sugeriria que existe algo em estoque naquela unidade.

O período é resolvido em **datas civis de `America/Sao_Paulo`**, e o dia da timeline também: uma perda registrada às 22h conta no dia em que o usuário a lançou, não no dia seguinte. Sem período informado, o padrão são os últimos 30 dias; o teto é de 90 dias cheios, aplicado a partir do fim do intervalo. Ver [decisoes-arquiteturais.md](./decisoes-arquiteturais.md#filtro-de-período-nas-listagens).

### Filtro de período (perdas, entradas, movimentações, relatórios e logs)

Todas as telas com filtro de data recebem a data civil escolhida pelo usuário e cobrem o **dia inteiro no fuso do
negócio**: escolher "hoje" traz o que foi lançado às 8h e o que foi lançado às 23h30, e não traz a madrugada seguinte.
Antes as bordas eram interpretadas em UTC e o dia final ficava de fora — o preset "hoje" devolvia lista vazia mesmo com
lançamentos feitos pela manhã. Detalhes em
[decisoes-arquiteturais.md](./decisoes-arquiteturais.md#filtro-de-período-nas-listagens).

## Alertas no cabeçalho (sino)

O sino fica no cabeçalho, ao lado do seletor de tema, e aparece em todas as telas para todos os papéis. Ele existe
porque o indicador de estoque baixo do painel só é visto por quem abre o painel: quem passa o dia em Entradas, Perdas
ou Estoque nunca esbarrava com ele.

**O sino é um espelho da situação atual, não uma caixa de entrada.** Nada é marcado como lido e não existe tabela de
notificações. Um alerta some sozinho quando o estoque é reposto ou a cobrança é baixada, que é o comportamento certo
para um aviso de estado — marcar como lido esconderia um problema que continua acontecendo. Ver
[decisoes-arquiteturais.md](./decisoes-arquiteturais.md#o-sino-de-alertas-é-estado-atual-não-caixa-de-entrada).

### Dentro da empresa-cliente

`GET /api/notifications` (`notifications.service.ts::getOperationalAlerts`), disponível para `admin`, `gerente` e
`operador` — todos precisam saber que um produto acabou, não só quem administra.

O contador vermelho soma **apenas o que pede ação**:

- **Produtos sem estoque**: `currentStock <= 0`.
- **Produtos abaixo do mínimo**: `currentStock > 0 and currentStock <= minStock`.

A condição de corte é a mesma do filtro "somente estoque baixo" da tela de estoque (`currentStock <= minStock`), e por
isso o link "Ver todos no estoque" abre exatamente o mesmo conjunto que o painel do sino resumiu. Como `minStock` é
validado como não negativo, produto zerado sempre satisfaz a condição, mesmo sem mínimo configurado.

O painel também traz duas informações que **não** entram no contador, para o sino não viver vermelho por operação
normal:

- **Perdas de hoje**: quantidade de registros e valor, no dia civil de `America/Sao_Paulo`, ignorando perdas
  canceladas. Registrar perda é rotina, não pendência.
- **Produtos sem estoque mínimo definido** (`minStock <= 0`): enquanto o cliente não preenche os mínimos, "estoque
  baixo" equivale na prática a "estoque zerado", e o alerta rende menos do que poderia. A linha leva para a tela de
  produtos e desaparece quando os mínimos são configurados.

A lista de produtos vem cortada nos cinco mais críticos (`MAX_PRODUTOS_NO_ALERTA`), ordenados com os zerados primeiro,
depois pela distância até o mínimo, com o nome desempatando para a ordem não variar entre duas consultas iguais. O
contador continua reportando o total real.

O link do painel abre `/estoque?lowStockOnly=1`, e a tela de estoque liga o filtro a partir dessa query. Existe um
`watch` sobre ela porque quem já está na tela de estoque não remonta o componente ao clicar no sino — sem o `watch`,
o link não faria nada.

O sino reaproveita as peças do sistema: `useDropdown` (o mesmo menu ancorado do menu do usuário), `CountBadge` (a
mesma bolinha de contagem do botão de filtros) e `BaseBadge` nas etiquetas de situação. A posição e a altura do painel
são medidas em JavaScript e presas às bordas da janela, porque o sino não é o último elemento do cabeçalho e o
alinhamento puro pelo botão jogava o painel para fora da tela no celular. Ver
[decisoes-arquiteturais.md](./decisoes-arquiteturais.md#o-painel-do-sino-é-preso-à-janela-não-ao-botão).

### Para o super administrador

`GET /api/billings/alerts` (`billings.service.ts::getBillingAlerts`), dentro do módulo de cobranças, que já exige
`super_admin` e já declara a travessia de plataforma. O super admin fora de impersonação não tem telas de estoque, e a
empresa Plataforma não tem produtos, então o sino dele mostra outra coisa:

- **Cobranças atrasadas** (`paidAt is null and dueDate < hoje`): contagem, valor somado e as cinco mais antigas. É o
  único item que entra no contador.
- **Vencendo em até 7 dias**: contexto, fora do contador — vencimento futuro é agenda, não pendência.

O link abre `/cobrancas?status=overdue`, com o mesmo mecanismo de query e `watch` da tela de estoque. Durante
impersonação o papel do token passa a ser `admin`, então o sino volta a mostrar os alertas operacionais da
empresa-cliente acessada, coerente com o menu.

### Atualização

O painel é consultado a cada 5 minutos e, fora do intervalo, em quatro situações:

- **Depois de qualquer gravação bem-sucedida.** Repor estoque, lançar entrada, registrar ou cancelar perda, ajustar,
  importar planilha e baixar cobrança mudam o alerta, e são fluxos em telas diferentes. Em vez de cada tela avisar o
  sino, o composable observa um contador que sobe em `api.ts` a cada resposta bem-sucedida de requisição que não é de
  leitura. As gravações em rajada (importação, exclusão em massa) são juntadas por uma espera de 700 ms, para virarem
  uma consulta só.
- **Ao abrir o sino**, porque quem clica está querendo conferir agora.
- **Quando o papel do usuário muda**: entrar ou sair da impersonação troca a origem dos alertas, e sem essa consulta o
  sino ficaria com o dado do contexto anterior.
- **Quando a aba volta ao foco.**

O intervalo mínimo entre consultas é de 1 minuto, ignorado nos três primeiros casos. A consulta é pulada com a aba em
segundo plano. Consulta forçada que chega com outra em andamento **não é descartada**: ela roda ao final da que estava
em voo, porque a resposta em voo é a de antes da mudança e deixá-la ganhar reporia o número velho na tela. Falha de rede não vira aviso na tela: o painel exibe que não
foi possível consultar e a verificação se repete sozinha — alerta é informação secundária e não pode interromper quem
está lançando entrada ou perda.

## Relatórios

Os detalhamentos de perdas e entradas são paginados e pesquisados no backend, mantendo os agregados por motivo sobre todo o período selecionado. Isso evita respostas sem limite conforme o histórico da empresa cresce.

A tela apresenta indicadores-resumo antes dos detalhamentos e permite gerar cada relatório em PDF pelo diálogo de impressão do navegador. Para perdas e entradas, a geração busca todas as páginas do período e da pesquisa aplicados antes de montar o documento; a paginação permanece apenas na visualização normal da tela. O documento inclui título, período, data de emissão e usuário responsável pela emissão.

## Apresentação de textos extensos

Nas tabelas e cartões, campos variáveis que podem receber conteúdo extenso — nomes, e-mails, descrições, observações, motivos, fornecedores, itens e contexto técnico de logs — usam o componente compartilhado `ExpandableText`. Textos curtos são exibidos normalmente; textos acima do limite mostram uma prévia truncada e um pequeno chevron para expandir/recolher o conteúdo dentro da própria célula. Sequências sem espaços usam quebra forçada para não alargar a tabela. Na impressão, o conteúdo completo é exibido.

Datas, números, status, perfis, badges e ações não usam esse comportamento porque possuem tamanho previsível. No mobile, esse controle de conteúdo convive com o accordion de linha das tabelas (`v-mobile-accordion`), sem substituir a navegação por campos do registro.

A relação de itens de uma entrada é a exceção: em vez de emendar todos os produtos numa linha só, a célula mostra a contagem (`12 itens`) e o clique abre um modal com a tabela de produto e quantidade, pelo componente `ItemsSummary`. Uma entrada com um item único continua sendo exibida direto, sem contador nem modal. Vale na listagem de entradas e no detalhamento de entradas dos relatórios. Na impressão não há para onde clicar, então a relação inteira sai no papel no lugar do botão.

**Coluna Ações só existe para quem pode agir.** Nas telas de categorias, unidades, produtos, estoque e perdas, o operador não tem nenhum botão de linha, e a coluna aparecia mesmo assim, vazia da primeira à última linha. Hoje o cabeçalho e as células seguem a mesma condição de papel (`canManage`), então a tabela do operador simplesmente não tem essa coluna. O `colspan` das linhas de "carregando" e "nenhum registro" acompanha a contagem real de colunas. Isso é aparência, não permissão: quem barra a ação continua sendo o `requireRole` da rota.

## Aviso de privacidade

Rota **pública** (`/privacidade`), alcançável pelo link no rodapé de qualquer tela — inclusive da tela
de login, sem sessão. Explica, em linguagem de quem trabalha no depósito, o que o sistema guarda, por
quanto tempo, quem vê, onde os dados ficam e como exercer os direitos.

Ser pública é requisito, não conveniência: a pessoa precisa poder ler **antes** de entrar, e quem
ainda não tem conta também tem direito de saber. A data de atualização é fixa no código — aviso que
diz "atualizado hoje" todos os dias não informa nada.

## Meus dados pessoais (tela de Perfil)

Qualquer usuário baixa, em **Perfil → Baixar meus dados**, um arquivo com o que o sistema guarda sobre
ele: o próprio cadastro (nome, e-mail, perfil de acesso, datas) e o histórico das ações que ele mesmo
registrou. Atende ao direito de acesso e portabilidade do titular sem depender de pedido ao
administrador.

O escopo é estreito de propósito: só atividade do próprio usuário — atividade de colega não entra —, o
hash da senha nunca sai, e o histórico técnico (data, hora e IP das requisições) aparece só como
resumo, com quantidade e período. O detalhamento desses registros é fornecido sob sigilo, mediante
pedido, porque é o que o Marco Civil exige.

## Logs

- Tela `/logs/atividades`: somente o `admin` consulta ações de escrita realizadas dentro da própria empresa. O `companyId` não é aceito da interface; é obtido obrigatoriamente da sessão.
- Tela `/logs/tecnicos`: somente o `super_admin`, fora do modo de impersonação, consulta requisições de toda a plataforma, identifica a empresa responsável e filtra por empresa, método, nível e período.
- Os dois históricos são somente leitura e paginados.

## Cadastro que a própria loja preenche e período de teste

Tela pública `/criar-conta`, acessível pelo link no rodapé do login. É o único caminho do sistema que cria empresa
sem alguém autenticado do outro lado.

1. **Plano.** Primeira aba, antes de qualquer campo: a pessoa vê a duração do teste e quanto vai pagar depois dele.
   Havendo um plano só, ele já vem marcado, mas continua visível. O teste não pede cartão.
2. **Dados gerais**, **Endereço** e **Seu acesso** repetem exatamente as abas do cadastro feito pelo `super_admin`,
   porque são os mesmos componentes: `FormTabs` desenha a faixa de abas, `CompanyFormFields` desenha os campos da
   empresa e do endereço, `useCepLookup` preenche o endereço pelo CEP e `validateCompanyFields` valida. Um formulário
   com validação própria daria dois caminhos diferentes para o mesmo dado entrar no banco.
3. Na última aba, um **aceite explícito do aviso de privacidade**, com link que abre o aviso em outra
   aba. Sem ele o cadastro não é enviado, e a API recusa: o campo é `literal(true)`, então mandar
   `false` é erro, não omissão. O instante do aceite fica gravado em `companies.privacy_accepted_at`.
4. `POST /signup` cria empresa e usuário administrador numa transação só, pela mesma função que o `super_admin` usa
   (`createCompanyWithAdmin`), e grava `subscriptionStatus = 'teste'` com `trialEndsOn` no último dia do prazo.
   **O dia do cadastro conta como o primeiro**, então 15 dias terminam 14 dias depois de hoje.
5. Terminado o cadastro, a pessoa entra pelo login normal. Não há confirmação de e-mail ainda: ela depende de um
   domínio próprio verificado no provedor de e-mail, o mesmo que a recuperação de senha espera.

Durante o teste, uma faixa no topo do sistema mostra quantos dias faltam, e ela fica âmbar nos últimos três dias. A
contagem é de **dias civis** no fuso de São Paulo: zero é o último dia, não "acabou", e é anunciado como
"Hoje é o último dia do seu teste" em vez de "0 dias", que pareceria defeito com o sistema ainda funcionando.

Passado o último dia, a API responde `402` em qualquer rota que não esteja na lista de liberadas, e a interface leva
para `/assinatura`. Os dados continuam intactos: o que acaba é o direito de usar, não o cadastro. Continuam abertas as
rotas necessárias para ver a situação, trocar a senha, sair e **exportar os dados pessoais**, esta última por
obrigação legal, não por conveniência (ver [decisões arquiteturais](./decisoes-arquiteturais.md)).

O pagamento ainda não acontece pelo sistema: a tela de assinatura orienta a falar com o suporte, e a liberação é
feita mudando `subscriptionStatus` para `ativa`.

## A tela de Perfil, em abas

`Perfil` é dividida em abas pelo mesmo `FormTabs` do cadastro de empresa: **Minha conta**, **Empresa**
(só para `admin`) e **Senha**. Empilhados num grid, os três blocos deixavam a tela comprida e
desequilibrada, com um cartão ocupando a largura toda entre dois estreitos.

As abas aqui **não são numeradas**, ao contrário das do cadastro: são seções independentes, e
"1. Minha conta" sugeriria um caminho a percorrer que não existe. O `numbered` do componente é o que
separa os dois usos.

Na aba **Empresa**, quem tem papel `admin` vê os dados cadastrais da própria empresa: nome fantasia,
razão social, CNPJ, inscrição estadual, responsável, e-mail, telefone e endereço. Serve para conferir
o que foi preenchido no cadastro, principalmente por quem se cadastrou sozinho.

**Só leitura.** Corrigir razão social ou CNPJ é assunto de contrato, e quem altera continua sendo a
plataforma; a tela diz isso em vez de deixar a pessoa procurar um botão que não existe.

Gerente e operador não veem a aba nem alcançam a rota (`GET /company` responde `403`): é informação
cadastral que eles não usam e não podem corrigir. O `super_admin` em modo suporte entra como `admin` e
vê os dados da empresa visitada, que é o que ele precisa ao atender.

A rota **não recebe identificador de empresa**: ela lê a empresa da sessão. É isso que a torna
inofensiva, e há teste garantindo que o administrador de uma empresa não alcança a outra.

## Cadastro de empresas-cliente e acesso como suporte

Fluxo exclusivo do papel `super_admin` (dono da plataforma, não de nenhum cliente) — mecanismo completo descrito em [decisões arquiteturais](./decisoes-arquiteturais.md#empresa-da-plataforma-e-super_admin).

1. Login do `super_admin` cai em `/selecionar-empresa`: lista todas as empresas-cliente (ativas clicáveis, suspensas desabilitadas) + um item pra "Configurações gerais do sistema" (`/empresas`).
2. Em `/empresas`, cadastra uma nova empresa-cliente junto com o primeiro usuário admin dela numa única transação (`POST /companies`). Para manter o modal compacto, a criação é dividida em três abas: **Dados gerais** (identificação e contato), **Endereço** e **Administrador da empresa**; na edição aparecem somente as duas primeiras, pois usuários são gerenciados separadamente. Cada aba combina ícone e texto no desktop e mantém apenas o ícone no mobile, com rótulo acessível e tooltip. Ao completar oito dígitos no CEP, a interface tenta preencher o endereço por BrasilAPI, ViaCEP e OpenCEP, nessa ordem, com timeout individual e fallback automático; os campos permanecem editáveis e uma resposta atrasada de um CEP anterior é ignorada. O cadastro reúne nome fantasia, razão social, CNPJ, inscrição estadual opcional, responsável, e-mail, telefone e endereço completo. CNPJ, telefone e CEP são normalizados; o CNPJ passa pela validação dos dígitos verificadores e não pode se repetir entre empresas não excluídas. **Nome fantasia, razão social, inscrição estadual e e-mail de contato também não podem se repetir**, comparados sem diferenciar maiúsculas nem espaços nas pontas. Telefone, nome do responsável e endereço **podem** repetir, e o nome do administrador também: o e-mail dele já é único em todo o sistema. Quando vários campos repetem, a resposta reclama de todos de uma vez, em vez de um por envio. Os motivos de cada inclusão e de cada exclusão estão em [decisões arquiteturais](./decisoes-arquiteturais.md). O campo aceita o **CNPJ alfanumérico** (letra maiúscula nas 12 primeiras posições, dígitos verificadores numéricos), o que vale para empresas abertas a partir de julho de 2026. Na mesma tela o `super_admin` edita esses dados, ativa/suspende o acesso (`PATCH /companies/:id/active` — suspender bloqueia login de todos os usuários daquela empresa imediatamente) e gerencia os demais usuários `super_admin` da plataforma (`/platform-users`). A própria conta autenticada não pode ser excluída.
3. Clicar numa empresa ativa em `/selecionar-empresa` "entra" nela (`POST /companies/:id/impersonate`): passa a ver e editar os dados daquela empresa com permissão de admin, mantendo seu próprio nome/e-mail de super_admin. A própria empresa "Plataforma" responde `403` nesse endpoint — ela nunca é uma empresa-cliente, e entrar nela exporia os `super_admin` na tela comum de usuários (ver [decisões arquiteturais](./decisoes-arquiteturais.md#empresa-da-plataforma-e-super_admin)).
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

Criar ou editar uma cobrança confere que a empresa é uma **empresa-cliente viva**: empresa excluída responde `404` e a
própria empresa "Plataforma" responde `403`. A chave estrangeira sozinha só garante que o id existe, e como
`listCompanies` esconde a Plataforma de toda tela, uma cobrança apontando pra ela apareceria em `/cobrancas` vinculada a
uma empresa que o `super_admin` não consegue abrir.

Diferente dos cadastros (produtos, categorias, unidades, usuários), excluir uma cobrança apaga a linha de verdade:
o registro é digitado à mão pelo próprio `super_admin` e a exclusão serve pra corrigir um lançamento errado, não pra
"arquivar" um histórico. Manter a linha escondida por `deleted_at` também travaria o índice único da competência, que
impediria relançar o mesmo mês depois de apagar o engano.
