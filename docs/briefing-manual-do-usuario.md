# Briefing: gerar o Manual do Usuário do HortiERP Lite

> **Como usar este arquivo:** mande o conteúdo inteiro para o Claude em uma conversa nova, com um
> pedido curto tipo *"gere o manual descrito neste briefing"*. Tudo que o Claude precisa saber sobre
> o sistema está aqui — ele não tem acesso ao código nem ao sistema rodando, então **não deve
> inventar nada que não esteja neste documento**.
>
> **Revisão de 24/08/2026:** os fatos deste briefing foram conferidos contra o código-fonte, arquivo
> por arquivo, e os pontos duvidosos foram testados no sistema rodando. Duas afirmações da versão
> anterior estavam **erradas** e foram corrigidas: o alerta de estoque baixo (seção 7.3) e a geração
> do PDF (seção 7.11). Se o comportamento do sistema mudar, corrija aqui também — é este arquivo que
> gera o manual.
>
> **Revisão de 25/08/2026:** entrou o lugar onde as mensagens de erro aparecem (seção 7.1), o prazo
> de guarda do histórico (seção 7.13), o asterisco de campo obrigatório e a coluna Ações (seção 7.1),
> a confirmação de senha no cadastro de usuário (seção 7.12), a conferência linha por linha da
> importação (seção 7.4), a trava de exclusão e a inativação de categoria e unidade (seção 7.2), o
> filtro por unidade na tela de produtos (seção 7.3), a coluna de unidade na tela de estoque
> (seção 7.8), o campo de lista com busca junto do nome **Situação** padronizado (seção 7.1) e as
> três situações da nota fiscal na listagem de entradas (seção 7.5).
> O **manual gerado antes desta data está incompleto**: falta o aviso de privacidade e o botão
> "Baixar meus dados", que já constam das seções 6.1 e 7.1.
>
> **Revisão de 28/08/2026:** entraram duas proteções novas de senha (seção 7.1) e a busca por SKU e
> código de barras na tela de Produtos, com a ressalva da tela de Estoque (seções 7.3 e 7.8).
> Entraram também quatro perguntas novas na seção 8.
> Duas correções em cima do **manual gerado em 25/08**, que precisa ser regerado: ele **não trouxe a
> inativação de categoria e unidade** nem a trava de exclusão de cadastro em uso, apesar de as duas
> já estarem na seção 7.2 desde aquela data. Confira que o capítulo de cadastros do manual novo cobre
> as duas coisas.
>
> **Revisão de 02/09/2026:** entrou o **sino de alertas** no cabeçalho (seção 7.14), com reflexo na
> descrição da tela (seção 6) e na lista de capítulos (seção 4). Entraram também três perguntas novas
> na seção 8 (26 a 28). O **manual gerado antes desta data não menciona o sino** e precisa ser
> regerado: é a novidade mais visível da tela para quem já usava o sistema.

---

## 1. A tarefa

Escreva o **Manual do Usuário do HortiERP Lite**, um sistema web de controle de estoque para
hortifrúti. O manual será entregue ao primeiro cliente junto com o acesso ao sistema.

O objetivo é bem concreto: **o cliente deve conseguir usar o sistema sem ligar perguntando cada
passo.** Todo trecho do manual deve ser julgado por isso. Se um parágrafo não responde a uma
pergunta que alguém faria de verdade, ele não deveria estar lá.

**Dados que o manual precisa citar textualmente:**

- **Endereço de acesso ao sistema:** `https://erp-163-176-246-92.nip.io`
- **Contato do suporte:** WhatsApp **(47) 99154-0607**

O endereço entra no capítulo do primeiro acesso, com a sugestão de salvar como favorito no navegador
do computador e na tela inicial do celular — é um endereço comprido e fácil de digitar errado. O
contato do suporte entra em **três pontos**: primeiro acesso, senha do administrador esquecida e
Perguntas Frequentes. São os momentos em que a pessoa está travada e não deveria ter que procurar o
número. Não crie uma seção só para o contato: ele deve estar onde o problema aparece.

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
  `[CAPTURA: tela de Estoque com o filtro "Somente estoque baixo" ligado]`
- Não prometa nada que não esteja neste briefing. Se algo parecer faltar, escreva
  `[CONFIRMAR: ...]` em vez de supor.

## 4. Estrutura que eu quero

1. **Primeiros 30 minutos** — uma página só, o caminho mínimo para o sistema começar a servir:
   entrar, cadastrar categorias e unidades, cadastrar (ou importar) os produtos, lançar o estoque
   inicial, lançar a primeira entrada. É a página mais importante do manual.
2. **Entrando no sistema** — login, esqueci a senha (falar com o administrador da empresa), **o que
   fazer quando é o próprio administrador que esqueceu**, trocar a própria senha, **baixar os próprios
   dados**, sair, e o encerramento automático por inatividade.
3. **Conhecendo a tela** — menu lateral, o que cada item faz, o sino de alertas no canto superior
   direito, como funciona no celular.
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
| Ver o sino de alertas | sim | sim | sim |
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

Uma consequência que o manual pode registrar em uma frase: **as telas do operador não têm coluna
Ações**. Onde ele não pode editar nem excluir, a coluna nem aparece, em vez de aparecer vazia. Se o
cliente comparar a tela do estoquista com a do gerente e notar a diferença, é isso.

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
dica, é o atalho que mais economiza tempo. **No celular não existe duplo clique:** lá a pessoa toca
no cartão para expandi-lo, e o **lápis aparece dentro do cartão aberto**. Diga isso de forma direta,
senão quem usa no depósito fica sem saber como editar.

**Perfil e Sair** ficam no menu que abre ao clicar no **círculo com as iniciais do usuário, no canto
superior direito da tela**. No celular aparece só o círculo, sem o nome ao lado.

Ao lado desse círculo existe um botão que **alterna entre modo claro e modo escuro** (a dica do botão
diz "Ativar modo escuro" / "Ativar modo claro"). Vale duas linhas no manual: quem clicar sem querer e
vir a tela ficar preta precisa saber que não quebrou nada e como voltar.

Um pouco à esquerda fica o **sino de alertas**, com uma bolinha vermelha e um número quando há algo
para olhar no estoque. Ele aparece em **todas as telas** e para **todos os perfis**. Está detalhado na
seção 7.14 e merece capítulo curto próprio ou um bloco dentro de "Conhecendo a tela" — é a parte da
tela que mais chama atenção e a que o cliente vai perguntar primeiro.

### 6.1 Nomes exatos dos botões

Use estes nomes, em negrito, exatamente como estão. Não invente variação nem sinônimo:

| Onde | Nome do botão |
|---|---|
| Criar categoria | **Nova categoria** |
| Criar unidade | **Nova unidade** |
| Criar produto | **Novo produto** |
| Abrir a importação de planilha | **Importar planilha** |
| Baixar o modelo da planilha | **Baixar planilha modelo** |
| Lançar entrada | **Nova entrada** |
| Registrar perda | **Registrar perda** (não "Nova perda") |
| Cancelar uma perda | **Cancelar perda** |
| Conferência de estoque em lote | **Ajuste em lote** |
| Criar usuário | **Novo usuário** |
| Filtro de estoque baixo | **Somente estoque baixo** |
| Sino de alertas: dica do botão | **Alertas: nada pendente** / **N alertas** |
| Link no rodapé do painel de alertas | **Ver todos no estoque** |
| Filtro de perdas canceladas | **Mostrar perdas canceladas** |
| Gerar o PDF do relatório | **Gerar PDF** |
| Baixar os próprios dados pessoais (em Perfil) | **Baixar meus dados** |
| Link no rodapé de todas as telas | **Aviso de privacidade** |

---

## 7. Os fatos do sistema

Esta é a matéria-prima do manual. Está escrita para você entender; **reescreva com as palavras do
cliente**, não copie.

### 7.1 Entrar e sair

- O login é por **e-mail e senha**. O e-mail não diferencia maiúsculas de minúsculas: pode digitar
  como quiser.
- **O sistema não envia e-mail nenhum** — nem de boas-vindas, nem de recuperação de senha. Isso muda
  a expectativa de quem está acostumado com o "esqueci minha senha" de outros sites, e precisa estar
  explícito no manual.
- Quem redefine a senha de um funcionário é o **administrador da empresa**, pela tela de Usuários.
- **E se quem esqueceu for o próprio administrador?** Se a empresa tem mais de um administrador, o
  outro redefine normalmente pela tela de Usuários. Se houver só um e for ele quem esqueceu, ninguém
  dentro da empresa consegue resolver: é preciso falar com o suporte, pelo WhatsApp
  **(47) 99154-0607**. Acrescente uma **Dica** recomendando cadastrar um segundo administrador de
  confiança desde o começo — é a diferença entre um problema de dois minutos e uma manhã parada.
- Cada um troca a própria senha em **Perfil**, informando a senha atual, a nova e a confirmação. O
  acesso a **Perfil** e a **Sair** está no menu do círculo com as iniciais, no canto superior direito.
- **Trocar a senha derruba as outras sessões, e não a sua.** Quem trocou continua trabalhando na
  mesma tela, sem precisar entrar de novo. Qualquer outra sessão aberta com a senha antiga (o celular
  esquecido logado, o computador do depósito, o navegador de outra pessoa) cai na hora e pede login.
  Diga isso de forma útil, como recurso e não como aviso técnico: é assim que se corta o acesso de
  alguém que sabia a senha antiga. Vale a mesma explicação quando o **administrador redefine a senha
  de um funcionário** pela tela de Usuários: o funcionário é desconectado na hora, em todos os
  aparelhos, e precisa entrar com a senha nova.
- **Errar a senha muitas vezes bloqueia por alguns minutos.** Na mesma conta, 5 erros seguidos travam
  o acesso por 1 minuto, 10 erros por 5 minutos e 15 erros por 15 minutos. A tela mostra em quanto
  tempo dá para tentar de novo, e acertar a senha limpa a contagem. No manual isso é uma frase curta,
  para quem errou três vezes e ficou com medo de bloquear a conta de vez saber que **não é bloqueio
  permanente** e que ninguém precisa ser chamado para desbloquear: é só esperar.
- Existe um **Aviso de privacidade** acessível de qualquer tela, pelo link no rodapé — inclusive na
  tela de login, antes de entrar. Ele explica o que o sistema guarda sobre a pessoa, por quanto tempo
  e o que ela pode fazer. Mencione em uma frase no capítulo 2 e outra no capítulo 3 (ao descrever o
  rodapé). Não reproduza o conteúdo dele no manual: o aviso é o documento oficial e pode mudar sem o
  manual mudar; duplicar o texto criaria duas versões que divergem.
- Ainda em **Perfil**, existe o botão **Baixar meus dados**. Ele baixa um arquivo com o que o sistema
  guarda sobre aquela pessoa: o cadastro dela e o histórico das ações que ela registrou. É um direito
  de quem tem dado guardado num sistema, e existe para a pessoa não precisar pedir a ninguém. Vale
  explicar em duas linhas, sem falar de lei nem de formato de arquivo: "é seu, e você baixa quando
  quiser". Não é exportação de relatório da loja — é o dado da própria pessoa.
- A conta da empresa e o **primeiro administrador** (nome, e-mail e senha) são criados por mim, o
  fornecedor, que entrega as credenciais direto ao cliente. Não existe autocadastro.
- **Onde as mensagens aparecem:** erro em campo preenchido errado sai em vermelho embaixo do próprio
  campo. Erro de uma ação — estoque insuficiente, nome repetido, permissão negada — aparece como
  **aviso no canto superior direito da tela**, por cima da janela aberta, com um X para fechar. Ele
  desaparece sozinho depois de alguns segundos. Isso vale a pena dizer no manual porque o aviso surge
  fora do formulário, e quem não souber olhar para o canto pode achar que o clique não fez nada.
- **Campo obrigatório tem asterisco vermelho** ao lado do nome do campo. Campo sem asterisco pode
  ficar vazio. Vale uma frase logo no capítulo que apresenta as telas: economiza a descoberta por
  tentativa e erro em todo formulário do sistema.
- Nas listagens, a última coluna se chama **Ações** e é onde ficam os ícones de ver, editar, excluir ou
  bloquear. No celular esses botões aparecem no pé do cartão do registro. Uma frase basta: sem ela o
  ícone parece decoração.
- **Todo campo de escolher numa lista funciona igual** em qualquer tela: clica, a lista abre com um
  campo **Buscar** em cima, e dá para digitar parte do nome em vez de rolar até achar. Isso vale
  também nos filtros. Diga isso uma vez, no capítulo das telas, e não repita em cada formulário.
- Onde a listagem mostra se o registro está ativo ou inativo, a coluna e o filtro se chamam
  **Situação**, com o mesmo nome em todas as telas.
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
- **Categoria e unidade podem ser inativadas.** É o caminho para aposentar um cadastro que não se usa
  mais: a inativa continua valendo para os produtos que já usam ela (nada muda no estoque nem no
  histórico) e deixa de aparecer na hora de cadastrar produto novo. As duas telas mostram a situação em
  etiqueta e têm filtro por situação. Explique com o exemplo que o cliente vive: parou de comprar em
  caixa, inativa "Caixa", e os produtos antigos que estavam em caixa continuam certos.
- **Categoria e unidade que já estão em algum produto não podem ser excluídas.** O sistema recusa e diz
  quantos produtos usam aquele cadastro. Para excluir, é preciso primeiro trocar a categoria ou a
  unidade desses produtos. Vale explicar o motivo em uma linha: sem essa trava o produto ficaria
  apontando para um cadastro que não existe mais e não seria mais possível salvá-lo. Isso vale também
  para a exclusão em lote, que recusa a seleção inteira se um dos itens estiver em uso.
- Nas listas de categorias, unidades e produtos é possível **marcar vários com a caixinha e excluir
  de uma vez**. Administrador e gerente podem.

### 7.3 Produtos

- Obrigatório: **nome**, **categoria**, **unidade**.
- Opcional: SKU (código interno), código de barras, custo, preço de venda e **estoque mínimo**.
- Esses campos opcionais podem ser **apagados depois** de preenchidos — basta limpar e salvar.
- **O estoque do produto não é digitado na tela do produto.** Um produto novo nasce com estoque zero,
  e o saldo só muda por entrada, perda ou ajuste. Isso confunde muita gente e merece um **Atenção**.
- **Estoque mínimo** é o que liga o alerta de "estoque baixo": o sistema avisa quando o saldo fica
  **igual ou menor** que esse número.
- **Atenção, isto foi testado e costuma surpreender:** como zero é igual a zero, produto **sem**
  estoque mínimo definido *também* aparece no alerta enquanto o saldo dele estiver zerado. Na prática,
  quem segue o capítulo 1 e cadastra os produtos antes de lançar o estoque vai ver **o catálogo
  inteiro** acusado como estoque baixo. Isso é normal e se resolve no passo do estoque inicial. O
  manual precisa avisar antes, senão o cliente liga achando que o sistema está errado.
- **Custo** é o que alimenta o "valor em estoque" do painel e o valor das perdas. Produto sem custo
  entra nas contas valendo zero — outro **Atenção** importante.
- O filtro da tela de produtos tem **categoria, unidade e situação**. Vale citar a unidade: é como
  responder "quais produtos eu vendo por quilo?" sem olhar linha por linha.
- **A busca da tela de Produtos procura por nome, por SKU e por código de barras**, e o próprio campo
  já diz isso. Consequência prática que vale um parágrafo no manual: um leitor de código de barras
  comum, daqueles de USB, funciona como se fosse um teclado, então basta clicar na busca e bipar o
  produto para ele aparecer. Não é integração com o sistema e não serve para lançar entrada nem
  perda, mas resolve o "achar o produto" de quem tem muito item cadastrado. Só prometa isso se o
  produto tiver o código de barras preenchido, o que também pode vir pela importação de planilha.
- **Produto também pode ser inativado**, com a mesma lógica de categoria e unidade da seção 7.2: sai
  das listas de escolha e dos números do painel, e o histórico dele continua intacto.

### 7.4 Importar produtos por planilha

Fica na tela de **Produtos**, no botão **Importar planilha**. É o caminho para o primeiro
carregamento do cadastro. Limite de **2000 linhas** por vez.

- **Existe um botão "Baixar planilha modelo"** dentro da tela de importação. Ele baixa uma planilha
  com os cabeçalhos certos e duas linhas de exemplo já preenchidas. **Coloque esse download como
  primeiro passo do capítulo** — é o que mais evita erro de importação.
- São **dez** colunas, e estes são os cabeçalhos do modelo, nesta ordem: `nome`, `categoria`,
  `unidade`, `codigo`, `codigo de barras`, `custo`, `preco de venda`, `estoque minimo`,
  `estoque atual`, `ativo`. Só **nome, categoria e unidade** são obrigatórias; as outras podem ficar
  em branco.
- Um cuidado de vocabulário: a coluna `codigo` é o mesmo campo que o cadastro do produto chama de
  **SKU** (código interno). No modelo a palavra "SKU" não aparece, então explique a equivalência em
  vez de trocar o nome da coluna.
- Na coluna de unidade pode escrever **o nome ou a abreviação** ("Quilograma" ou "kg"). Foi feito
  assim porque na planilha ninguém escreve o nome completo.
- Números aceitam **os dois formatos**: `1.234,56` (brasileiro) e `1234.56` (americano).
- A coluna de ativo aceita `sim`, `s`, `1`, `ativo`, `verdadeiro` e os equivalentes de não. Em branco
  vira ativo.
- **Linha com problema não impede o resto.** Quando parte da planilha está errada, o botão passa a
  ser **Importar as N válidas**: entra o que está pronto e as linhas com problema ficam de fora, sem
  nada criado pela metade. O que não pode é reenviar a planilha inteira depois de corrigir, porque o
  que já entrou voltaria como duplicado. Por isso o botão **Baixar lista de erros** entrega uma
  planilha **no mesmo formato da importação**, já com a coluna do motivo: é esse arquivo que a pessoa
  corrige e envia na segunda vez. Esse é o caminho a ensinar no manual, com o exemplo de uma planilha
  de 100 produtos em que 50 estão prontos.
- Depois de uma importação parcial, a janela **continua aberta** mostrando o que entrou e a lista do
  que ficou de fora, justamente para dar tempo de baixar a lista.
- Antes de confirmar, o sistema mostra uma **prévia** com o que vai acontecer: os contadores (linhas
  lidas, prontas, com problema), etiquetas com o que é novo (categoria, unidade, produto sem custo) e
  uma **lista linha por linha do que vai entrar**, com produto, categoria, unidade, custo e estoque
  inicial. Havendo erro, a lista é dos problemas, por número de linha. Nos dois casos, se for muita
  linha o sistema mostra as primeiras e informa quantas ficaram de fora. Vale destacar essa conferência
  no manual: é o momento de revisar antes de gravar, e no primeiro carregamento do cadastro é o que
  evita importar 300 produtos com a categoria errada.
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
  mercadoria ter chegado noutro. A **chave de acesso** tem de ter **exatamente 44 dígitos** — chave
  incompleta é recusada, e vale dizer isso para o cliente não achar que é defeito.
- **Itens:** produto, quantidade e, se quiser, o custo unitário daquele recebimento. Cabem até 200
  itens na mesma entrada. Na listagem, a coluna **Itens** mostra quantos produtos a entrada tem
  (`12 itens`) e o clique abre uma janelinha com a relação, produto e quantidade, para uma nota
  grande não esticar a tabela. Impresso, sai a relação inteira.
- **Anexos:** até **3 arquivos** por entrada, em XML, PDF, JPG, PNG ou WEBP, até 10 MB cada. Arquivo
  acima do limite é recusado na hora, com o nome do arquivo e o tamanho dele na mensagem, e **a
  entrada não é salva enquanto o arquivo recusado estiver selecionado**. Isso é de propósito: antes
  dava para salvar a entrada e o anexo ficava para trás sem ninguém perceber. Quem precisa lançar
  logo pode tirar o arquivo da seleção, salvar, e anexar depois pela tela de detalhes.
- **Situação da nota na listagem:** a coluna **Nota fiscal** tem três respostas. **Anexada** (o
  arquivo está guardado), **Sem arquivo** (os dados da nota foram digitados, mas o arquivo não subiu)
  e **Sem nota**. Vale explicar as três, porque "Sem arquivo" é exatamente a lista do que o pessoal
  precisa terminar de anexar.

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
- **sai** dos relatórios e dos valores de perda do painel;
- **gera um ajuste automático no histórico de movimentações**, devolvendo a quantidade ao estoque,
  com a observação "Estorno de perda cancelada" seguida do motivo digitado. Isso foi testado: depois
  de cancelar uma perda de 10 unidades ficam **dois** movimentos no histórico — a perda de −10 e um
  ajuste de +10. Esse ajuste **não foi lançado por ninguém à mão**, é o próprio sistema registrando a
  devolução para o histórico não ter buraco sem explicação. Sem essa frase no manual, o cliente liga
  perguntando que ajuste é aquele. Note também que, por ser um ajuste, ele continua aparecendo no
  gráfico de movimentações do painel — só os *valores de perda* é que saem;
- sai da lista de perdas, e volta a aparecer se ligar o filtro **Mostrar perdas canceladas**;
- na planilha exportada, aparece na coluna de situação, e o valor perdido sai em branco para não ser
  somado por engano.

Depois de cancelar, lança-se a perda certa como um registro novo.

**Entrada lançada errada** → não existe cancelamento de entrada. Explique o motivo em uma frase: se a
mercadoria já saiu, estornar a entrada deixaria o estoque negativo. A correção é pelo **ajuste de
estoque**, que é auditado.

Uma perda já cancelada não aceita mais correção, e a linha dela nem abre no duplo clique.

### 7.8 Consulta de estoque e movimentações

- **Estoque** lista os produtos com o saldo atual e tem o filtro **Somente estoque baixo**. As colunas
  são produto, categoria, **unidade**, estoque atual e estoque mínimo: a unidade fica em coluna própria
  e as duas colunas de quantidade trazem só o número, alinhado à direita, para dar para comparar de
  cima a baixo. No celular, onde não há colunas, a unidade continua junto do número.
- **A busca da tela de Estoque procura só pelo nome do produto**, diferente da tela de Produtos, que
  também acha por SKU e por código de barras. Vale uma linha no manual: quem se acostumou a bipar o
  produto em Produtos vai tentar o mesmo aqui e não vai achar nada. Se o comportamento das duas telas
  for igualado depois, apague esta ressalva.
- **Movimentações** é o histórico completo e imutável de tudo que mexeu no estoque, com três tipos:
  **entrada**, **perda** e **ajuste**. Filtra por produto, tipo e período, e mostra o usuário
  responsável por cada movimento.
- Sobre os **ajustes**: parte deles é lançada à mão na conferência de estoque, mas parte é
  **automática** — criada pelo sistema quando uma perda é cancelada ou quando entra o estoque inicial
  de uma importação. Diga isso, senão o ajuste que aparece sozinho parece erro.
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

- A **contagem** de produtos com estoque baixo é completa, mas a **lista** que aparece embaixo mostra
  no máximo **10 produtos**. Vale uma frase, no mesmo espírito da observação sobre os "5 maiores".

**Período:** o padrão são os últimos 30 dias e o máximo é **90 dias** por consulta. Um detalhe que
precisa estar no manual: o painel **corta em silêncio** — pedir seis meses devolve os últimos 90 dias
sem nenhum aviso na tela. O dia é sempre o dia inteiro no horário de Brasília — escolher "hoje" traz
o que foi lançado às 8h e o que foi lançado às 23h30.

### 7.11 Relatórios

A tela tem **três abas**, e o cliente escolhe uma antes de tudo:

| Aba | O que traz |
|---|---|
| **Estoque por categoria** | situação atual do estoque; **esta aba não tem filtro de período** |
| **Perdas por período** | indicadores e detalhamento das perdas |
| **Entradas por período** | indicadores e detalhamento das entradas |

Cada aba mostra indicadores no topo e o detalhamento embaixo, com pesquisa e filtro de período.

**PDF — este ponto errou na versão anterior do manual e precisa sair certo.** Existe um botão
**Gerar PDF** na própria tela de Relatórios, e ele **não** é um atalho para o Ctrl+P: o botão primeiro
reúne **todas as páginas** do relatório e estampa a data de emissão, e só depois abre a impressão do
navegador. Quem aperta Ctrl+P direto imprime **apenas as linhas que estão na tela naquele momento** —
se o mês tem 300 perdas e a tela mostra 15, o PDF sai com 15 linhas parecendo completo, e é esse
arquivo que vai para o contador.

O passo a passo do manual, portanto, é: escolher a aba e o período → clicar em **Gerar PDF** (esperar
um instante, ele carrega o relatório inteiro) → no diálogo de impressão que abre, escolher **Salvar
como PDF** em vez de uma impressora → salvar. Ponha um **Atenção** dizendo para não usar o Ctrl+P
direto, e por quê. O documento sai com título, período, data de emissão e o nome de quem emitiu.

**Planilha:** o botão de exportar **não tem texto — é um ícone de seta para baixo** na barra de cima
da tela. Diga isso, ou o cliente procura um botão escrito "Exportar" e não acha. Duas informações que
valem: ele exporta **tudo que os filtros estão mostrando, não só a página que está na tela**; e as
telas que têm esse botão são **Produtos, Estoque, Movimentações, Entradas, Perdas e Logs de
atividades**. O arquivo sai no formato que o **Excel em português** abre certo, com os números na
vírgula — diga que abre direto no Excel, sem falar em CSV, ponto e vírgula ou codificação.

### 7.12 Usuários

Só o administrador. Cadastra nome, e-mail, perfil e senha, e pode desativar quem saiu da empresa. A
senha precisa ter **no mínimo 8 caracteres** (e no máximo 72), informe isso, senão o administrador
topa com o aviso sem entender. A senha é digitada duas vezes, no campo **Senha** e em **Confirmar senha**: quem digita
não é quem vai usar, e o campo é mascarado, então o erro de digitação só apareceria na hora em que o
funcionário não conseguisse entrar. Existe também um **Gerar senha aleatória**, que preenche os dois
campos e copia a senha para a área de transferência — é o caminho recomendado, junto de "mande a senha
para a pessoa e peça para ela trocar em Perfil".

Duas travas que parecem defeito e não são, e por isso entram no manual:

- **O administrador não consegue rebaixar o próprio perfil nem desativar a própria conta.** Sem essa
  trava a empresa poderia ficar sem nenhum administrador, e ninguém mais entraria na tela de usuários.
- Excluir um usuário **libera o e-mail dele**. Se a pessoa for recontratada, usa-se o mesmo e-mail
  normalmente. O usuário excluído não consegue mais entrar.

### 7.13 Logs de atividades

Só o administrador. Mostra quem criou, alterou, excluiu, importou, ajustou ou cancelou o quê, e
quando, dentro da própria empresa. Só leitura. É a tela para responder "quem mexeu nisso?".

O histórico é guardado por **5 anos** e depois disso o sistema o limpa sozinho. Diga isso no manual sem
alarme: é prazo de sobra para qualquer conferência, e guardar para sempre seria o problema, não a
solução. Depois desse prazo, o nome de um usuário já excluído também deixa de aparecer no histórico.

### 7.14 O sino de alertas

O **sino** fica no canto superior direito, à esquerda do botão de modo claro/escuro. Vale para os três
perfis e aparece em todas as telas — inclusive para o operador, que é justamente quem precisa saber
que um produto acabou.

Quando há algo para olhar, o sino ganha uma **bolinha vermelha com um número**. Clicando, abre um
painel com o resumo. O número conta duas coisas, e só essas duas:

- **Produtos sem estoque** — o saldo chegou a zero (ou abaixo).
- **Produtos abaixo do mínimo** — ainda tem mercadoria, mas menos do que o estoque mínimo cadastrado
  para aquele produto.

O painel lista os **5 produtos mais críticos**, com os zerados primeiro, mostrando quanto tem e qual
é o mínimo. O botão **Ver todos no estoque** abre a tela de Estoque já com o filtro **Somente estoque
baixo** ligado, com a lista completa.

Três coisas que precisam estar no manual, senão viram chamado de suporte:

- **O sino não guarda histórico e não tem "marcar como lido".** Ele mostra a situação de agora. Assim
  que a mercadoria é reposta e a entrada é lançada, o alerta some sozinho. Isso é de propósito: um
  aviso que se apaga com um clique esconderia uma prateleira que continua vazia.
- **O sino é o mesmo aviso do painel, só que sempre à vista.** Quem já conhecia o indicador "Produtos
  com estoque baixo" do painel não está vendo um número novo, e sim o mesmo número onde ele não
  precisa ir procurar.
- **Enquanto ninguém cadastrar o estoque mínimo dos produtos, o sino só avisa o que zerou.** É por
  isso que o painel mostra a linha *"N produtos ainda não têm estoque mínimo definido"*, que leva para
  a tela de Produtos. Vale insistir nisso no capítulo de cadastro de produtos: **o estoque mínimo é o
  campo que faz o sino ser útil**, porque é ele que permite avisar antes de acabar, e não depois.

O painel ainda traz, embaixo e **fora da contagem**, as **perdas de hoje** (quantos registros e quanto
custou). Explique por que isso não conta no número vermelho: registrar perda é o trabalho normal do
dia, não uma pendência — se contasse, o sino viveria vermelho e ninguém mais olharia para ele.

**O sino se atualiza sozinho, e isso precisa estar escrito com todas as letras.** Assim que a pessoa
lança uma entrada, registra ou cancela uma perda, faz um ajuste ou importa uma planilha, o número do
sino se corrige em seguida, sem recarregar a página e sem clicar no sino. Fora isso ele também se
atualiza de poucos em poucos minutos e quando a pessoa volta para a aba do sistema. Diga isso na
prática, com o exemplo de sempre: *repôs a batata e lançou a entrada, o alerta da batata sai do sino
sozinho*. Se der algum problema de conexão na hora da consulta, o painel avisa que não conseguiu
consultar e tenta de novo sozinho, sem atrapalhar o que estiver sendo lançado.

---

## 8. Perguntas que o cliente vai fazer

Transforme cada uma numa entrada da seção de Perguntas Frequentes, com resposta curta e um link para
o capítulo correspondente:

1. Cadastrei o produto e o estoque ficou zero. Por quê?
2. Cadastrei tudo e o painel diz que **todos** os produtos estão com estoque baixo. Está errado?
3. Como coloco o estoque que já tenho hoje na loja?
4. Esqueci de lançar a entrada de ontem. Posso lançar com a data de ontem?
5. Lancei a entrada com a quantidade errada. Como conserto?
6. Lancei com a data errada. Como conserto?
7. Lancei uma perda que não existiu. Como apago?
8. Sumiu uma perda da lista. Para onde foi?
9. Cancelei uma perda e apareceu um **ajuste** que eu não lancei. Que ajuste é esse?
10. Por que o sistema não deixa eu registrar essa perda?
11. Por que o valor em estoque está R$ 0,00 se tem mercadoria?
12. Por que o gráfico de categoria mostra "8" e não os quilos?
13. Esqueci minha senha.
14. O administrador esqueceu a senha dele. E agora?
15. O sistema me desconectou sozinho.
16. O PDF da nota não abre no meu celular.
17. Minha importação de planilha não passou e não entrou nada.
18. Qual a diferença entre lançar uma perda e ajustar o estoque?
19. Como mando o relatório do mês para o contador?
20. O funcionário saiu. O que faço com o acesso dele?
21. Quero ver quem alterou aquele produto.
22. Troquei minha senha e fui desconectado no celular. É defeito?
23. Errei a senha várias vezes e agora não deixa mais entrar. Bloqueou pra sempre?
24. Dá pra usar leitor de código de barras?
25. Parei de usar uma categoria. Apago ou tem outro jeito?
26. O que é a bolinha vermelha no sininho lá em cima?
27. Repus a mercadoria e o sino continua marcando. Está travado? (Resposta curta: o sino se corrige
    sozinho depois do lançamento. Se ainda marcar, é porque a entrada não foi lançada, ou o produto
    continua abaixo do mínimo cadastrado — que é diferente de estar zerado.)
28. O sino só avisa quando o produto zera. Dá para avisar antes de acabar?

## 9. O que NÃO entra no manual

Importante, para não vazar coisa que não é do cliente:

- **Nada sobre a administração da plataforma.** Existem telas de cadastro de empresas, cobranças,
  seleção de empresa e histórico técnico que pertencem a mim, o fornecedor do sistema. O cliente não
  tem acesso a nada disso e não deve nem saber que existe. Não mencione. Isso inclui o **sino de
  alertas visto do meu lado**: para mim ele mostra cobranças atrasadas, e o manual só descreve o sino
  do estoque, que é o que o cliente vê.
- Nada de instalação, servidor, backup, banco de dados, atualização ou configuração técnica.
- Nada de preço, contrato, plano ou suporte comercial — isso eu trato à parte.
- Não invente atalho de teclado, aplicativo de celular, integração com balança, emissão de nota,
  leitor de código de barras, controle de vendas ou controle financeiro. **O sistema não faz nada
  disso.** É controle de estoque: o que entra, o que se perde e o que tem.

## 10. Entrega

Um único arquivo Markdown, pronto para eu revisar e virar PDF. Sumário com links internos, títulos
numerados, tabelas onde couber, e os marcadores `[CAPTURA: ...]` nos pontos onde a imagem ajuda.

**Não deve sobrar nenhum `[CONFIRMAR]` no manual final.** O endereço de acesso, o contato do suporte e
os nomes de todos os botões estão neste briefing (seções 1 e 6.1). Se ainda assim faltar algum dado,
use `[CONFIRMAR: ...]` em vez de supor — mas confira antes se a resposta não está aqui.

Comece o documento com uma abertura de dois parágrafos explicando, em linguagem de dono de loja, o
que o sistema resolve: saber o que tem em estoque, o que entrou, o que se perdeu e quanto isso custou
— com o histórico de quem lançou cada coisa.
