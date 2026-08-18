# Briefing: gerar o Manual do Usuário do HortiERP Lite

> **Como usar este arquivo:** mande o conteúdo inteiro para o Claude em uma conversa nova, com um
> pedido curto tipo *"gere o manual descrito neste briefing"*. Tudo que o Claude precisa saber sobre
> o sistema está aqui — ele não tem acesso ao código nem ao sistema rodando, então **não deve
> inventar nada que não esteja neste documento**.

---

## 1. A tarefa

Escreva o **Manual do Usuário do HortiERP Lite**, um sistema web de controle de estoque para
hortifrúti. O manual será entregue ao primeiro cliente junto com o acesso ao sistema.

O objetivo é bem concreto: **o cliente deve conseguir usar o sistema sem ligar perguntando cada
passo.** Todo trecho do manual deve ser julgado por isso. Se um parágrafo não responde a uma
pergunta que alguém faria de verdade, ele não deveria estar lá.

## 2. Quem vai ler

A equipe do cliente — dono/gerente da loja e os funcionários que mexem no estoque. Assuma:

- Sabem usar celular e navegador. **Não** sabem o que é API, banco de dados, cache, JSON ou CSV.
- Vão ler no meio do trabalho, com pressa, procurando uma coisa específica.
- Muitos vão usar o sistema **no celular**, dentro do depósito.
- Nunca usaram um ERP antes. Termos do próprio negócio (nota fiscal, chave de acesso, perda,
  inventário) eles conhecem bem; termos de software, não.

## 3. Como escrever

- **Português do Brasil**, falando com o leitor ("você abre", "clique em"). Nada de "o usuário deve".
- Frase curta. Uma ideia por frase.
- **Zero jargão técnico.** Não use: endpoint, rota, API, payload, transação, backend, cache, token,
  soft delete, CSV, log, request. Onde o conceito importa, traduza: "planilha" em vez de CSV,
  "histórico de quem fez o quê" em vez de log de auditoria.
- Instruções em **passos numerados**, sempre nomeando o que a pessoa vê na tela: *"clique em **Nova
  entrada**"*, com o nome exato do botão em negrito.
- Quando uma regra do sistema costuma gerar dúvida, explique **o porquê** em uma ou duas frases.
  É o porquê que evita a ligação, não a instrução.
- Blocos de destaque curtos onde couber: **Atenção** (o que dá problema), **Dica** (atalho que
  economiza tempo).
- Onde uma imagem ajudaria muito, deixe um marcador para eu colar a captura depois, no formato:
  `[CAPTURA: tela de Estoque com o filtro "só estoque baixo" ligado]`
- Não prometa nada que não esteja neste briefing. Se algo parecer faltar, escreva
  `[CONFIRMAR: ...]` em vez de supor.

## 4. Estrutura que eu quero

1. **Primeiros 30 minutos** — uma página só, o caminho mínimo para o sistema começar a servir:
   entrar, cadastrar categorias e unidades, cadastrar (ou importar) os produtos, lançar o estoque
   inicial, lançar a primeira entrada. É a página mais importante do manual.
2. **Entrando no sistema** — login, esqueci a senha (falar com o administrador da empresa),
   trocar a própria senha, sair, e o encerramento automático por inatividade.
3. **Conhecendo a tela** — menu lateral, o que cada item faz, como funciona no celular.
4. **Cadastros que vêm antes de tudo** — categorias, unidades de medida, produtos.
5. **Importar produtos por planilha** — capítulo próprio, é onde mais erram.
6. **O dia a dia** — entrada de mercadoria, registro de perda, consulta de estoque.
7. **Quando erraram o lançamento** — o capítulo que responde "lancei errado, e agora?".
8. **Conferência de estoque (inventário)** — ajuste pontual e ajuste em lote.
9. **Painel e relatórios** — o que cada número significa, como gerar PDF, como exportar planilha.
10. **Usuários e permissões** — quem pode o quê, com uma tabela.
11. **Histórico de atividades** — para o administrador saber quem fez o quê.
12. **Perguntas frequentes** — use a lista da seção 8 deste briefing como base, e acrescente as que
    você identificar lendo os fatos.
13. **Glossário** — termos do sistema em uma linha cada.

Um sumário no começo, com links internos.

---

## 5. Os papéis de acesso

Existem três perfis dentro da empresa do cliente. **Cada tela e cada ação do manual precisa dizer
quem pode fazer.**

| Perfil | Quem é, na prática |
|---|---|
| **Administrador** | O dono ou o responsável pelo sistema. Faz tudo, e é o único que mexe em usuários e vê o histórico de atividades. |
| **Gerente** | Encarregado. Faz tudo do operador, mais os cadastros, as correções e os ajustes de estoque. |
| **Operador** | Estoquista. Lança entrada de mercadoria e perda, consulta estoque e relatórios. |

Quem pode o quê:

| Ação | Administrador | Gerente | Operador |
|---|---|---|---|
| Lançar entrada de mercadoria | sim | sim | **sim** |
| Registrar perda | sim | sim | **sim** |
| Consultar estoque, painel e relatórios | sim | sim | sim |
| Anexar e baixar nota fiscal | sim | sim | sim |
| Excluir um anexo | sim | sim | não |
| Cadastrar/editar categoria, unidade, produto | sim | sim | não |
| Importar produtos por planilha | sim | sim | não |
| Corrigir dados de uma entrada já lançada | sim | sim | não |
| Corrigir ou cancelar uma perda | sim | sim | não |
| Ajustar estoque (inventário) | sim | sim | não |
| Cadastrar e editar usuários | **só ele** | não | não |
| Ver o histórico de atividades | **só ele** | não | não |

Vale explicar no manual por que lançar entrada e perda é liberado para todos: são operações do dia a
dia de quem está no depósito, travar por perfil só atrasaria o trabalho. Já **corrigir** e **ajustar
estoque** são decisões de quem responde pelo estoque, e por isso ficam com gerente e administrador.

## 6. O menu

Itens do menu lateral, na ordem em que aparecem:

**Dashboard** · **Produtos** · **Categorias** · **Unidades** · **Entradas** · **Estoque** ·
**Perdas** · **Relatórios** · **Usuários** (só administrador) · **Logs de atividades** (só
administrador).

Dentro de **Estoque** existe também a tela de **Movimentações**, o histórico completo.

No celular o menu vira um botão e as tabelas se transformam em cartões: cada linha da tabela fica
sendo um cartão que abre e fecha ao ser tocado, mostrando os campos daquele registro. Textos longos
(observações, nomes compridos) aparecem cortados com uma setinha para expandir.

Em quase todas as listas, **dois cliques em cima da linha abrem a edição** — vale mencionar como
dica, é o atalho que mais economiza tempo.

---

## 7. Os fatos do sistema

Esta é a matéria-prima do manual. Está escrita para você entender; **reescreva com as palavras do
cliente**, não copie.

### 7.1 Entrar e sair

- O login é por **e-mail e senha**. O e-mail não diferencia maiúsculas de minúsculas: pode digitar
  como quiser.
- Não existe "esqueci minha senha" por e-mail. Quem redefine é o administrador da empresa, pela tela
  de Usuários. Isso precisa estar claro no manual.
- Cada um troca a própria senha em **Perfil**, informando a senha atual, a nova e a confirmação.
- **Encerramento automático:** 30 minutos sem usar e a sessão cai. No último minuto aparece um aviso
  com contagem regressiva. Para continuar conectado é preciso **clicar no botão do aviso** — só mexer
  o mouse não resolve, e isso é de propósito: assim ninguém deixa o sistema aberto e destravado num
  computador do depósito sem perceber.

### 7.2 Categorias e unidades vêm antes dos produtos

- **Categoria** é como o cliente agrupa a mercadoria (Folhosas, Frutas, Legumes…).
- **Unidade de medida** tem nome e abreviação (Quilograma / kg; Caixa / cx; Unidade / un).
- Todo produto precisa de uma categoria e uma unidade **já cadastradas**. Por isso essas duas telas
  vêm primeiro no manual.
- Nomes não podem repetir dentro da empresa, e a comparação ignora maiúsculas: "Frutas" e "frutas"
  são a mesma coisa.
- Nas listas de categorias, unidades e produtos é possível **marcar vários com a caixinha e excluir
  de uma vez**. Administrador e gerente podem.

### 7.3 Produtos

- Obrigatório: **nome**, **categoria**, **unidade**.
- Opcional: SKU (código interno), código de barras, custo, preço de venda e **estoque mínimo**.
- Esses campos opcionais podem ser **apagados depois** de preenchidos — basta limpar e salvar.
- **O estoque do produto não é digitado na tela do produto.** Um produto novo nasce com estoque zero,
  e o saldo só muda por entrada, perda ou ajuste. Isso confunde muita gente e merece um **Atenção**.
- **Estoque mínimo** é o que liga o alerta de "estoque baixo": o sistema avisa quando o saldo fica
  igual ou menor que esse número. Produto com estoque mínimo zero nunca aparece no alerta.
- **Custo** é o que alimenta o "valor em estoque" do painel e o valor das perdas. Produto sem custo
  entra nas contas valendo zero — outro **Atenção** importante.

### 7.4 Importar produtos por planilha

Fica na tela de **Produtos**. É o caminho para o primeiro carregamento do cadastro. Limite de **2000
linhas** por vez.

- Colunas: nome, categoria, unidade, SKU, custo, preço de venda, estoque mínimo e estoque atual, e
  se o produto está ativo.
- Na coluna de unidade pode escrever **o nome ou a abreviação** ("Quilograma" ou "kg"). Foi feito
  assim porque na planilha ninguém escreve o nome completo.
- Números aceitam **os dois formatos**: `1.234,56` (brasileiro) e `1234.56` (americano).
- A coluna de ativo aceita `sim`, `s`, `1`, `ativo`, `verdadeiro` e os equivalentes de não. Em branco
  vira ativo.
- **É tudo ou nada.** Se uma linha estiver errada, nada é importado. Vale explicar o motivo: se o
  sistema importasse só as linhas boas, na segunda tentativa as já importadas voltariam como
  duplicadas, e ninguém entende mais o que entrou.
- Antes de confirmar, o sistema mostra uma **prévia** com o que vai acontecer e a lista de erros por
  número de linha. Se houver muitos erros, ele mostra os primeiros e informa quantos ficaram de fora.
- Existe a opção de **criar as categorias e unidades que faltarem** durante a importação, útil no
  primeiro carregamento.
- **O estoque informado na planilha entra como saldo inicial** e aparece no histórico como um ajuste,
  para o histórico explicar de onde veio aquele saldo.
- Se vier quantidade **sem custo**, o sistema avisa antes de confirmar: aqueles produtos vão entrar no
  estoque valendo R$ 0,00 e o painel vai mostrar a loja cheia com valor zero.

### 7.5 Entrada de mercadoria

Tela **Entradas** → botão **Nova entrada**. Qualquer perfil pode lançar.

Uma entrada tem:

- **Cabeçalho:** **data da entrada**, fornecedor (texto livre) e observações. A data vem preenchida
  com hoje e pode ser trocada antes de salvar — é para o caso de a mercadoria ter chegado ontem e o
  lançamento sair só hoje. Não aceita data futura, nem mais de um ano para trás. **A data não pode
  ser alterada depois de salvar**, então vale conferir antes.
- **Nota fiscal (opcional):** número, série, chave de acesso, data de emissão e valor total. A data
  de emissão da nota é independente da data da entrada: a nota pode ter sido emitida num dia e a
  mercadoria ter chegado noutro.
- **Itens:** produto, quantidade e, se quiser, o custo unitário daquele recebimento.
- **Anexos:** até **3 arquivos** por entrada, em XML, PDF, JPG, PNG ou WEBP, até 10 MB cada.

Ao salvar, o estoque de cada produto **sobe na hora**. Se algum produto da lista tiver problema, nada
é gravado — nem a entrada, nem o estoque.

Na lista e nos relatórios, quem lançou aparece como **Recebido por**.

Os anexos são privados: só quem tem acesso à empresa consegue abrir. No computador, PDF e imagem
abrem na própria tela. **No celular, PDF não abre embutido** (nenhum navegador de celular faz isso),
então aparecem dois botões: **Abrir no aparelho**, que entrega o arquivo para o visualizador do
celular, e **Baixar**. Isso deve estar no manual, porque parece defeito e não é.

Dá para pesquisar a entrada pelo **número ou pela chave de acesso** da nota.

**Depois de lançada**, administrador e gerente podem corrigir fornecedor, observações e os dados da
nota fiscal. **Produtos, quantidades e custos não podem ser alterados** — mexer neles mudaria o
estoque do passado. Quando a quantidade é que está errada, o caminho é o ajuste de estoque.

### 7.6 Registro de perda

Tela **Perdas**. Qualquer perfil pode registrar.

- Informa produto, quantidade, **data da perda**, **motivo** e observações. A data segue a mesma
  regra da entrada: vem com hoje, pode ser trocada antes de salvar, não aceita futuro nem mais de um
  ano atrás, e não é editável depois.
- Motivos disponíveis: **Vencido**, **Avariado**, **Roubo/Furto**, **Erro operacional**, **Outro**.
- O estoque cai na hora. **Se não houver saldo suficiente, o sistema recusa** — não existe estoque
  negativo.
- O sistema guarda o custo do produto **no momento da perda**. Assim, reajustar o custo depois não
  muda o valor das perdas antigas. Vale explicar: é por isso que o relatório do mês passado não muda
  quando se atualiza um preço hoje.
- Na lista e nos relatórios, quem lançou aparece como **Registrado por**.

### 7.7 "Lancei errado, e agora?"

Este capítulo é o que mais evita ligação. A regra geral: **nada é apagado, tudo é corrigido de forma
rastreável.**

**Perda com motivo ou observação errados** → corrigir (lápis na linha ou dois cliques). Só motivo e
observações são editáveis.

**Perda com produto, quantidade ou data errados** → **cancelar a perda**. O cancelamento pede um
motivo e devolve a quantidade ao estoque. A perda cancelada:

- continua no histórico, com a marca **Cancelada** e a quantidade riscada;
- **sai** dos relatórios e de todos os números do painel;
- sai da lista de perdas, e volta a aparecer se ligar o filtro **Mostrar perdas canceladas**;
- na planilha exportada, aparece na coluna de situação, e o valor perdido sai em branco para não ser
  somado por engano.

Depois de cancelar, lança-se a perda certa como um registro novo.

**Entrada lançada errada** → não existe cancelamento de entrada. Explique o motivo em uma frase: se a
mercadoria já saiu, estornar a entrada deixaria o estoque negativo. A correção é pelo **ajuste de
estoque**, que é auditado.

Uma perda já cancelada não aceita mais correção, e a linha dela nem abre no duplo clique.

### 7.8 Consulta de estoque e movimentações

- **Estoque** lista os produtos com o saldo atual e tem o filtro **só estoque baixo**.
- **Movimentações** é o histórico completo e imutável de tudo que mexeu no estoque, com três tipos:
  **entrada**, **perda** e **ajuste**. Filtra por produto, tipo e período, e mostra o usuário
  responsável por cada movimento.
- Cada movimento guarda o **saldo que ficou depois dele**, o que permite reconstruir a história do
  produto.

### 7.9 Conferência de estoque (ajuste)

Tela **Estoque**. Administrador e gerente.

Dois caminhos, para a mesma coisa:

- **Correção pontual:** lápis na linha, ou dois cliques. Abre já com o produto e o saldo atual.
- **Ajuste em lote:** botão **Ajuste em lote**, para depois de uma contagem física. Várias linhas de
  produto + quantidade de uma vez.

Como funciona:

- Informa-se a **quantidade que existe de verdade na prateleira** — o número final, não a diferença.
- O **motivo é obrigatório** e vale para o lote inteiro (ex: "contagem física do dia 15").
- Produtos cuja contagem bateu com o sistema são simplesmente ignorados, sem gerar movimento. Se
  **nenhum** produto do lote tiver diferença, o sistema avisa que não havia nada para ajustar.
- Cada diferença entra no histórico como **ajuste**, com o motivo e o responsável.

Deixe claro no manual que **ajuste não substitui entrada nem perda**: é para corrigir divergência de
contagem. Mercadoria que chegou se lança em Entradas; mercadoria que estragou, em Perdas. Se o ajuste
virar o atalho para tudo, o cliente perde o histórico de por que o estoque mudou.

### 7.10 Painel (Dashboard)

Mostra, para o período escolhido:

- Total de produtos ativos e quantos estão com estoque baixo.
- **Valor em estoque**: soma de quantidade × custo de cada produto.
- **Valor perdido no período**.
- Gráfico diário de entradas, perdas e ajustes.
- **Produtos por categoria** e **perdas por motivo**.
- As 10 movimentações mais recentes do período.

Duas coisas que geram dúvida e precisam de explicação:

- **O sistema nunca soma quantidades de unidades diferentes.** Somar 3 kg com 2 caixas não significa
  nada, então cada total aparece **separado por unidade**. É por isso que o gráfico de categorias
  mostra *quantos produtos* a categoria tem, e não "quanto tem em estoque" — e as quantidades por
  unidade aparecem ao passar o mouse.
- Nos detalhamentos, o sistema mostra os **5 maiores** de cada grupo e informa quantos ficaram de
  fora. Não é limite de cadastro, é para o gráfico continuar legível.
- Produto sem saldo **conta** na quantidade de produtos da categoria, mas não aparece nas quantidades.
- Produtos inativos não entram em nenhum número do painel.

**Período:** o padrão são os últimos 30 dias e o máximo é **90 dias** por consulta. O dia é sempre o
dia inteiro no horário de Brasília — escolher "hoje" traz o que foi lançado às 8h e o que foi lançado
às 23h30.

### 7.11 Relatórios

- Indicadores no topo, detalhamento de perdas e entradas embaixo, com pesquisa e filtro de período.
- **PDF:** gerado pelo diálogo de impressão do navegador. O documento sai com título, período, data de
  emissão e o nome de quem emitiu. Vale um passo a passo curto de como salvar como PDF em vez de
  imprimir, porque é exatamente o tipo de coisa que gera ligação.
- **Planilha:** as telas de Produtos, Estoque, Movimentações, Entradas e Perdas exportam a lista para
  planilha, já no formato que o **Excel em português** abre certo, com os números na vírgula. Diga que
  o arquivo abre direto no Excel — sem falar em CSV, ponto e vírgula ou codificação.

### 7.12 Usuários

Só o administrador. Cadastra nome, e-mail, perfil e senha, e pode desativar quem saiu da empresa.

Duas travas que parecem defeito e não são, e por isso entram no manual:

- **O administrador não consegue rebaixar o próprio perfil nem desativar a própria conta.** Sem essa
  trava a empresa poderia ficar sem nenhum administrador, e ninguém mais entraria na tela de usuários.
- Excluir um usuário **libera o e-mail dele**. Se a pessoa for recontratada, usa-se o mesmo e-mail
  normalmente. O usuário excluído não consegue mais entrar.

### 7.13 Logs de atividades

Só o administrador. Mostra quem criou, alterou, excluiu, importou, ajustou ou cancelou o quê, e
quando, dentro da própria empresa. Só leitura. É a tela para responder "quem mexeu nisso?".

---

## 8. Perguntas que o cliente vai fazer

Transforme cada uma numa entrada da seção de Perguntas Frequentes, com resposta curta e um link para
o capítulo correspondente:

1. Cadastrei o produto e o estoque ficou zero. Por quê?
2. Como coloco o estoque que já tenho hoje na loja?
3. Esqueci de lançar a entrada de ontem. Posso lançar com a data de ontem?
4. Lancei a entrada com a quantidade errada. Como conserto?
5. Lancei com a data errada. Como conserto?
6. Lancei uma perda que não existiu. Como apago?
7. Sumiu uma perda da lista. Para onde foi?
8. Por que o sistema não deixa eu registrar essa perda?
9. Por que o valor em estoque está R$ 0,00 se tem mercadoria?
10. Por que o gráfico de categoria mostra "8" e não os quilos?
11. Esqueci minha senha.
12. O sistema me desconectou sozinho.
13. O PDF da nota não abre no meu celular.
14. Minha importação de planilha não passou e não entrou nada.
15. Qual a diferença entre lançar uma perda e ajustar o estoque?
16. Como mando o relatório do mês para o contador?
17. O funcionário saiu. O que faço com o acesso dele?
18. Quero ver quem alterou aquele produto.

## 9. O que NÃO entra no manual

Importante, para não vazar coisa que não é do cliente:

- **Nada sobre a administração da plataforma.** Existem telas de cadastro de empresas, cobranças,
  seleção de empresa e histórico técnico que pertencem a mim, o fornecedor do sistema. O cliente não
  tem acesso a nada disso e não deve nem saber que existe. Não mencione.
- Nada de instalação, servidor, backup, banco de dados, atualização ou configuração técnica.
- Nada de preço, contrato, plano ou suporte comercial — isso eu trato à parte.
- Não invente atalho de teclado, aplicativo de celular, integração com balança, emissão de nota,
  leitor de código de barras, controle de vendas ou controle financeiro. **O sistema não faz nada
  disso.** É controle de estoque: o que entra, o que se perde e o que tem.

## 10. Entrega

Um único arquivo Markdown, pronto para eu revisar e virar PDF. Sumário com links internos, títulos
numerados, tabelas onde couber, e os marcadores `[CAPTURA: ...]` nos pontos onde a imagem ajuda.

Comece o documento com uma abertura de dois parágrafos explicando, em linguagem de dono de loja, o
que o sistema resolve: saber o que tem em estoque, o que entrou, o que se perdeu e quanto isso custou
— com o histórico de quem lançou cada coisa.
