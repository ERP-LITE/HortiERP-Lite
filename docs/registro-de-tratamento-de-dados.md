# Registro das operações de tratamento de dados pessoais — HortiERP Lite

> **O que é este documento.** É o registro que o art. 37 da LGPD pede de quem trata dado pessoal, e
> também o insumo que um advogado precisa para redigir o contrato de operador e o aviso de
> privacidade. Ele descreve **o que o sistema faz de fato**: cada afirmação aqui foi conferida no
> código, não presumida.
>
> **O que este documento não é.** Não é parecer jurídico. As bases legais indicadas são a leitura
> técnica de quem construiu o sistema e precisam ser confirmadas — sobretudo porque quem define
> finalidade e base legal é o controlador, não o operador.
>
> Revisão: 24/08/2026.

---

## 1. Quem é quem

Esta é a distinção que organiza todo o resto, e costuma vir invertida:

| Papel | Quem | O que decide |
|---|---|---|
| **Controlador** | a empresa-cliente (o hortifrúti) | decide coletar os dados dos próprios funcionários e usar o sistema; define finalidade e prazo |
| **Operador** | o fornecedor do HortiERP Lite | trata os dados **em nome do controlador**, seguindo instrução dele |
| **Titulares** | funcionários da empresa-cliente; a pessoa de contato do cliente; terceiros citados em notas fiscais | — |

O art. 42 prevê **responsabilidade solidária**: o operador responde junto quando descumpre a lei ou
trata fora das instruções recebidas. E "instruções" só existem se estiverem escritas — daí a
importância do contrato listado na seção 9.

**Canal de contato do titular:** WhatsApp (47) 99154-0607.

---

## 2. Inventário: qual dado, onde, por quê, por quanto tempo

### 2.1 Funcionários da empresa-cliente

| Dado | Onde fica | Finalidade | Base legal indicada | Prazo |
|---|---|---|---|---|
| Nome, e-mail | `users` | identificar quem acessa e quem lançou cada movimentação | execução de contrato (art. 7º, V), pelo controlador | enquanto a conta existir; **5 anos** após a exclusão, depois anonimizado |
| Senha | `users.password_hash` | autenticação | idem | idem |
| Perfil de acesso e situação | `users.role`, `users.active` | controle de permissão | idem | idem |
| Nome + ação realizada | `activity_logs` | trilha de auditoria: responder "quem lançou isso" | obrigação legal fiscal (art. 7º, II) e legítimo interesse (art. 7º, IX) | **5 anos** |
| **Endereço IP**, navegador, data/hora | `system_logs` | registro de acesso e investigação de incidente | **obrigação legal** (art. 7º, II) — Marco Civil da Internet, art. 15 | **180 dias** |

A senha nunca é guardada em texto legível: só o resumo criptográfico (bcrypt). Nem o sistema nem o
fornecedor têm como recuperá-la — apenas substituí-la.

### 2.2 A empresa-cliente e sua pessoa de contato

| Dado | Onde fica | Observação |
|---|---|---|
| Razão social, nome fantasia, inscrição estadual | `companies` | dado de pessoa jurídica; não é dado pessoal |
| **CNPJ ou CPF** (`document`) | `companies` | **é dado pessoal quando for CPF** — caso de MEI e de empresário individual |
| Nome, e-mail e telefone do contato | `companies.contact_name`, `contact_email`, `phone` | dado pessoal de pessoa física identificada |
| Endereço completo | `companies` | endereço do estabelecimento |

Prazo: enquanto o contrato durar. Encerrado o contrato, a eliminação é feita pelo procedimento da
seção 6.2.

### 2.3 Terceiros citados nas operações

| Dado | Onde fica | Observação |
|---|---|---|
| Nome do fornecedor (texto livre) | `stock_entries.supplier_name` | digitado pelo operador da loja; **pode ser nome de pessoa física**, como produtor rural |
| Nota fiscal anexada (XML ou PDF) | disco do servidor + `stock_entry_attachments` | o XML de NF-e traz CNPJ ou CPF, endereço e às vezes nome do emitente |

São dados que o **controlador** coletou de terceiros no curso normal da atividade comercial, e que
compõem documento fiscal. Ficam sujeitos ao prazo de guarda fiscal, não ao critério do sistema.

Os arquivos ficam com permissão `0600` em diretório `0700`, fora da árvore pública, e só são
entregues por rota autenticada que confere a empresa dona do anexo.

### 2.4 O que o sistema **não** trata

Declarar isto é tão importante quanto o inventário, porque muda o enquadramento:

- **Nenhum dado sensível** (art. 5º, II): nada de saúde, biometria, dado genético, origem racial,
  convicção religiosa, opinião política ou filiação sindical.
- **Nenhum dado de criança ou adolescente** (art. 14).
- **Nenhuma decisão automatizada** que afete o titular (art. 20). O sistema calcula saldo e alerta de
  estoque baixo; não pontua, classifica nem avalia pessoas.
- **Nenhum dado de pagamento**: não há cartão, conta bancária nem processamento financeiro.
- **Nenhum corpo de requisição vai para o log.** Verificado no código: o registro guarda método,
  rota, situação, duração, IP e navegador — nunca o conteúdo enviado. É por isso que **senha nunca
  aparece em log**, que é um dos vazamentos mais comuns em auditoria.
- **Nenhum envio de e-mail.** Não existe biblioteca de envio no projeto. Não há e-mail de
  boas-vindas, de recuperação de senha nem de notificação — logo, nenhum dado pessoal trafega por
  esse caminho.
- **A consulta de CEP não envia dado pessoal.** O frontend chama BrasilAPI, ViaCEP ou OpenCEP com
  **apenas os oito dígitos do CEP**, sem nome, sem identificador e sem credencial.

---

## 3. Quem tem acesso, e como isso é limitado

### 3.1 Dentro da empresa-cliente

| Perfil | Alcance |
|---|---|
| Operador | lança entrada e perda; consulta estoque, painel e relatórios |
| Gerente | tudo do operador, mais cadastros, correções e ajuste de estoque |
| Administrador | tudo; único que gerencia usuários e vê o histórico de atividades |

A permissão é verificada **no servidor**, em cada rota, nunca apenas na tela.

### 3.2 O fornecedor (operador)

O fornecedor tem um perfil de plataforma que pode **acessar a empresa do cliente para dar suporte**
(impersonação). Três pontos que o contrato precisa cobrir:

- É acesso a todos os dados daquela empresa, com as permissões de administrador.
- **Fica registrado.** Todo acesso em modo suporte grava a marca `impersonating` no log técnico, com
  a empresa real de origem — dá para auditar quando o fornecedor entrou.
- O contrato deve autorizar expressamente esse acesso e restringi-lo à finalidade de suporte.

### 3.3 Isolamento entre empresas-cliente

Cada consulta filtra pela empresa da sessão. O banco ainda **não** tem políticas de RLS (a trava no
próprio banco de dados), então o isolamento depende de o filtro estar escrito em toda consulta. Para que um
esquecimento não chegue a produção, existe uma verificação automática que lê o código e acusa
consulta a tabela multiempresa em função que não menciona a empresa: hoje **118 consultas
verificadas, nenhuma desprotegida**, e as poucas travessias propositais estão declaradas com
justificativa. Ela roda no CI e reprova o deploy.

Isso é mitigação, não equivalente ao RLS — ver pendência na seção 9. O pré-requisito das políticas está
implementado: a aplicação fala com o banco por um papel sem superusuário, e o papel dono ficou restrito
às migrations e ao backup. Sem essa separação, política escrita não barraria consulta nenhuma, porque
superusuário ignora RLS.

---

## 4. Onde os dados ficam, fisicamente

| Onde | O que | País |
|---|---|---|
| Máquina virtual na Oracle Cloud, região **São Paulo** | banco de dados de produção e arquivos de nota fiscal | **Brasil** |
| Backblaze B2, bucket `hortierp-backup-jlle`, endpoint `s3.us-east-005` | cópia de segurança diária | **Estados Unidos** |

**Os dados em produção não saem do Brasil.** Só a cópia de segurança sai, e com uma característica
que muda a análise: o arquivo é **cifrado em AES-256 antes de deixar o servidor**, e a chave não está
no provedor — ele guarda um bloco que não consegue ler. Continua sendo transferência internacional
para efeito do art. 33, e precisa de base contratual, mas o risco concreto é baixo.

Retenção no bucket: 30 dias, por regra de ciclo de vida configurada no painel do provedor.

**Suboperadores** a declarar no contrato e no aviso de privacidade: Oracle Cloud (hospedagem) e
Backblaze (armazenamento da cópia cifrada).

---

## 5. Medidas de segurança (art. 46)

Verificadas no código, não declaradas por otimismo:

| Medida | Situação |
|---|---|
| Senha guardada só como resumo criptográfico (bcrypt) | ✅ |
| Sessão em cookie `httpOnly` + `secure` + `sameSite`, validade de 8h | ✅ o JavaScript da página não consegue ler o token |
| HTTPS obrigatório, com HSTS | ✅ |
| Política de segurança de conteúdo (CSP) sem `unsafe-inline` em scripts | ✅ por hash, verificado no CI |
| Encerramento automático por 30 min de inatividade | ✅ resolve o computador destravado no depósito |
| Limite de tentativas de login e de requisições | ✅ |
| Permissão verificada no servidor em cada rota | ✅ |
| Isolamento entre empresas verificado automaticamente | ✅ 118 consultas |
| Banco sem porta exposta à internet (rede interna do Docker) | ✅ |
| Anexos com permissão restrita e entrega só por rota autenticada | ✅ |
| Validação de tipo e assinatura dos arquivos enviados | ✅ |
| Cópia de segurança cifrada, com teste de restauração | ✅ |
| Corpo de requisição fora do log | ✅ senha nunca vai para log |
| Acesso do fornecedor registrado | ✅ |
| Autenticação em dois fatores | ❌ não existe |
| RLS no banco | ⚠️ papel sem superusuário aplicado; políticas pendentes (ver seção 9) |

---

## 6. Eliminação dos dados

### 6.1 Por prazo, automático

O serviço `retention` roda semanalmente, sozinho, junto com o sistema:

- `system_logs` acima de **180 dias**: apagados.
- `activity_logs` acima de **5 anos**: apagados.
- Usuário excluído há mais de **5 anos**: anonimizado — nome vira `Usuário removido`, e-mail vai para
  um domínio reservado que ninguém pode registrar, e o resumo da senha deixa de ser válido. O nome
  também é limpo do histórico de atividades, senão a anonimização não teria efeito prático.

Por que 180 dias e não menos: o Marco Civil (art. 15) obriga **guardar** o registro de acesso por 6
meses. É piso legal. A LGPD manda não guardar além do necessário — é teto. Os dois se encontram
exatamente aí, e o sistema **recusa iniciar** com prazo menor, para que ninguém encurte por engano
achando que está sendo cauteloso.

### 6.2 No encerramento do contrato

Existe procedimento de exclusão definitiva: apaga todas as linhas daquela empresa em todas as tabelas
e os arquivos de nota fiscal do disco. É irreversível, exige acesso ao servidor e a confirmação do
nome exato da empresa, e **não tem botão na interface** de propósito.

Uma limitação a declarar com honestidade no contrato: **as cópias de segurança já criadas continuam
contendo os dados até expirarem** (30 dias). Eliminação imediata inclusive das cópias é operação
manual no painel do provedor. Prometer eliminação instantânea e total seria falso.

---

## 7. Direitos do titular (art. 18)

| Direito | Como é atendido hoje |
|---|---|
| Confirmação e acesso | **Perfil → Baixar meus dados**: arquivo com o cadastro e o histórico das ações da própria pessoa. Sem depender de pedido ao administrador |
| Portabilidade | mesmo arquivo, em formato aberto e legível por qualquer programa |
| Correção | administrador da empresa, na tela de Usuários |
| Anonimização e eliminação | por prazo (6.1) ou pelo procedimento de encerramento (6.2). Pedido individual é decisão do controlador, respeitados os prazos legais de guarda |
| Informação sobre uso compartilhado | aviso de privacidade em `/privacidade`, seção "Onde os dados ficam" |
| Revogação de consentimento | não se aplica: o tratamento não se apoia em consentimento, e sim em execução de contrato e obrigação legal |

O detalhamento dos registros de acesso (a lista de IPs) não vai no arquivo baixado: o titular é
informado de que o registro existe, com quantidade e período, e o detalhe é fornecido sob o sigilo que
o Marco Civil (art. 10) exige.

---

## 8. Incidente de segurança

O art. 48 obriga comunicar a ANPD e o titular quando houver incidente com risco relevante.

**Ainda não existe procedimento escrito** — é a pendência mais barata de resolver da lista e deveria
ser resolvida antes do primeiro cliente, não depois do primeiro incidente. O documento é curto: quem
detecta, quem decide se há risco relevante, em quanto tempo comunica, o que se registra, e como se
avisa o cliente (que é o controlador e responde à ANPD).

O que o sistema já oferece para investigar um incidente: log técnico com IP e horário por 180 dias,
histórico de atividades por 5 anos, e o registro de todo acesso do fornecedor em modo suporte.

---

## 9. Pendências

Em ordem de importância. As três primeiras são jurídicas e não se resolvem em código:

| # | Pendência | Quem resolve |
|---|---|---|
| 1 | **Contrato de operador com o cliente**, incluindo autorização do acesso de suporte, os suboperadores, a transferência da cópia cifrada e o destino dos dados no encerramento | advogado |
| 2 | **Aviso de privacidade** — a tela existe (rota pública `/privacidade`, link no rodapé de todas as telas e na de login) e o texto foi redigido a partir deste registro. **Falta a revisão jurídica do texto** | advogado |
| 3 | **Procedimento de resposta a incidente** (seção 8) | fornecedor, com revisão jurídica |
| 4 | **Cláusulas contratuais com a Backblaze** para a transferência internacional | advogado |
| 5 | **Políticas de RLS no banco** — a trava de isolamento no próprio banco. O pré-requisito (papel de aplicação sem superusuário) está implementado; faltam as políticas por empresa | fornecedor |
| 6 | Autenticação em dois fatores | fornecedor |

Vale perguntar ao advogado sobre o **regime simplificado para agentes de tratamento de pequeno
porte**, regulamentado pela ANPD: se aplicável, dispensa formalidades como a nomeação obrigatória de
encarregado, desde que exista canal de contato com o titular.

---

## 10. Histórico de revisões

| Data | O que mudou |
|---|---|
| 24/08/2026 | Aviso de privacidade publicado dentro do sistema, em rota pública, redigido a partir deste registro. Pendência 2 passou de "não existe nada" para "falta revisão jurídica do texto" |
| 24/08/2026 | Primeira versão. Inventário levantado a partir do código; retenção por prazo, anonimização, exclusão definitiva e exportação dos dados do titular implementados nesta mesma data |
