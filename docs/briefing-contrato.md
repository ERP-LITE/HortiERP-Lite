# Briefing: gerar o Contrato de Prestação de Serviço do HortiERP Lite

> **Como usar este arquivo:** mande o conteúdo inteiro para o Claude em uma conversa nova, com um
> pedido curto tipo *"gere o contrato descrito neste briefing"*. Ele não tem acesso ao código nem ao
> sistema rodando, então **não deve inventar nada que não esteja aqui**.
>
> **Este briefing é irmão dos outros dois.** O
> [briefing da proposta comercial](./briefing-proposta-comercial.md) descreve o que é prometido ao
> prospecto; este descreve o que é assinado. Os dois precisam dizer a mesma coisa: promessa na
> proposta que não aparece no contrato vira discussão, e restrição no contrato que não estava na
> proposta vira quebra de confiança na assinatura.
>
> **Regra de manutenção:** mudança que altera obrigação, prazo ou tratamento de dado pessoal entra
> aqui na mesma entrega. A fonte técnica é o
> [registro de tratamento de dados](./registro-de-tratamento-de-dados.md), conferido contra o código.
>
> **Revisão de 16/09/2026:** primeira versão. Criado porque a pendência nº 1 do registro de
> tratamento de dados é justamente o contrato de operador, e não existia material para redigi-lo.
> Já nasce incluindo a recuperação de senha e a segunda transferência internacional (seção 6).

---

## 0. A ressalva que precisa estar no topo do resultado

**O documento gerado é uma minuta, não um contrato pronto para assinar.** Ele precisa de revisão por
advogado antes do primeiro cliente. O texto deve trazer isso explícito num bloco no início, para
ninguém enviar por engano.

Duas razões concretas, e não formalidade:

1. A LGPD prevê responsabilidade solidária entre controlador e operador (art. 42). A redação das
   cláusulas de responsabilidade e limitação define quem paga o quê num incidente.
2. Duas transferências internacionais de dados (seção 6) precisam de base legal do art. 33, e a
   escolha do instrumento é decisão jurídica.

Vale o contrato sugerir ao advogado a pergunta sobre o **regime simplificado para agentes de
tratamento de pequeno porte**, regulamentado pela ANPD. Se aplicável, dispensa formalidades como a
nomeação obrigatória de encarregado, desde que exista canal de contato com o titular.

---

## 1. Tom e formato

- Português do Brasil, linguagem jurídica **simples**. O cliente é dono de hortifrúti, não
  departamento jurídico de multinacional.
- Cláusulas numeradas, com títulos que digam o assunto. Nada de "Cláusula Sétima" sem dizer do que
  trata.
- Onde a obrigação tiver exceção, a exceção fica **na mesma cláusula**, não numa nota de rodapé.
- Evite "as partes acordam que o CONTRATADO envidará seus melhores esforços". Diga o que é feito, em
  quanto tempo, e o que acontece se não for.
- O contrato é entre pessoas jurídicas. Use CONTRATANTE (o cliente) e CONTRATADA (o fornecedor).

---

## 2. Objeto

Licença de uso de sistema web de controle de estoque, em regime de software como serviço, com
hospedagem, manutenção e suporte pela CONTRATADA.

Deixe claro no objeto o que o sistema **é**: controle de estoque, entradas de mercadoria, perdas e
relatórios. E o que ele **não é**: não emite documento fiscal, não é caixa (PDV), não controla vendas
nem financeiro. A lista completa está na seção 6 do briefing da proposta comercial e precisa ser
reproduzida aqui, porque é no contrato que ela vale.

---

## 3. Os dados são do cliente

Cláusula curta e explícita: **os dados cadastrados são de propriedade da CONTRATANTE.** A CONTRATADA
os trata apenas para executar o serviço, não os usa para outra finalidade, não os cede, não os vende
e não os usa para treinar nada.

---

## 4. Papéis na LGPD

| Papel | Quem | O que decide |
|---|---|---|
| **Controlador** | a CONTRATANTE | decide coletar os dados dos próprios funcionários, define finalidade e prazo |
| **Operador** | a CONTRATADA | trata os dados **em nome do controlador**, seguindo instrução dele |

Consequências que precisam virar cláusula:

- A CONTRATANTE é quem responde perante a ANPD e perante os titulares pelos dados que ela decidiu
  cadastrar.
- A CONTRATADA trata os dados **somente** conforme as instruções da CONTRATANTE e este contrato.
- A CONTRATADA comunica a CONTRATANTE ao receber pedido de titular dirigido a ela por engano.

---

## 5. Acesso de suporte (impersonação) — cláusula obrigatória

Este é o ponto que mais precisa de autorização expressa, e o que um cliente atento vai perguntar.

Os fatos, conferidos no sistema:

- A CONTRATADA possui perfil de plataforma que permite **acessar a empresa da CONTRATANTE para dar
  suporte**, com as permissões de administrador.
- **É acesso a todos os dados daquela empresa.**
- **Todo acesso desse tipo fica registrado**, com marca própria no log técnico e a identificação de
  quem entrou. É auditável.

O contrato precisa:

1. **Autorizar expressamente** esse acesso.
2. **Restringi-lo à finalidade de suporte técnico**, e dizer que qualquer outro uso é vedado.
3. Registrar que o acesso é auditável e que a CONTRATANTE pode solicitar o extrato desses acessos.

Não esconda isso em letra miúda. Cliente que descobre depois trata como quebra de confiança; cliente
que lê na assinatura trata como transparência.

---

## 6. Onde os dados ficam, e o que sai do país

O sistema, com os dados do dia a dia, roda em **servidor no Brasil, em São Paulo**.

**Duas coisas saem do país, por motivos diferentes, e as duas precisam constar do contrato** como
transferência internacional (LGPD, art. 33):

### 6.1 Cópia de segurança

Enviada **criptografada** para armazenamento nos Estados Unidos. O arquivo é fechado com senha que
fica apenas com a CONTRATADA: o provedor guarda um bloco que não consegue abrir. Retenção de 30 dias.

Suboperador: **Backblaze**.

### 6.2 Envio do e-mail de redefinição de senha

Diferente do backup, e a diferença importa: **aqui não há criptografia que resolva.** Para entregar a
mensagem, o provedor precisa do **nome e do endereço de e-mail** do destinatário em claro.

A mensagem é enviada a partir de servidor no Brasil, mas os **registros do envio** (para quem, quando,
qual assunto) ficam em servidores nos Estados Unidos por 30 dias. O corpo da mensagem não contém senha
nem dado do negócio: apenas o nome da pessoa e um link de uso único e vida curta.

Suboperador: **Resend**.

### 6.3 Suboperadores a declarar

Três, nominalmente, no contrato:

| Suboperador | Para quê | Onde |
|---|---|---|
| **Oracle Cloud** | hospedagem do sistema e do banco | Brasil (São Paulo) |
| **Backblaze** | armazenamento da cópia de segurança cifrada | Estados Unidos |
| **Resend** | envio do e-mail de redefinição de senha | envio no Brasil, registros nos Estados Unidos |

O contrato deve prever que a inclusão de novo suboperador seja comunicada à CONTRATANTE.

---

## 7. Prazos de guarda e eliminação

Estes prazos são executados automaticamente pelo sistema, semanalmente. Não são promessa: são
comportamento verificado.

| O que | Prazo | Observação |
|---|---|---|
| Registro técnico de acesso (data, hora, IP) | **180 dias** | é **piso legal**, não escolha: Marco Civil da Internet, art. 15 |
| Histórico de atividades | **5 anos** | acompanha o prazo de fiscalização tributária |
| Nome e e-mail de usuário excluído | anonimizados após **5 anos** | o nome também sai do histórico de atividades |
| Pedido de redefinição de senha | apagado **7 dias** após vencer | o link em si vale 1 hora |
| Cópia de segurança | **30 dias** | |

Sobre os 180 dias, vale uma frase no contrato: o Marco Civil **obriga guardar** por 6 meses, e a LGPD
manda não guardar além do necessário. Os dois se encontram exatamente aí. O sistema recusa iniciar com
prazo menor, para ninguém encurtar por engano achando que está sendo cauteloso.

---

## 8. Encerramento do contrato

### 8.1 Exportação antes de sair

A CONTRATANTE pode exportar seus dados pelas telas de Produtos, Estoque, Movimentações, Entradas,
Perdas e Histórico de atividades, em planilha, a qualquer momento durante a vigência.

O contrato precisa definir: **por quanto tempo depois do encerramento o acesso permanece disponível
para exportação**. Sugestão a decidir: «PRAZO, ex.: 30 dias».

### 8.2 Exclusão definitiva

Existe procedimento de exclusão definitiva que apaga todas as linhas daquela empresa em todas as
tabelas, e os arquivos de nota fiscal do disco. É irreversível e exige confirmação do nome exato da
empresa.

**Limitação a declarar com honestidade, e não em letra miúda:** as **cópias de segurança já criadas
continuam contendo os dados até expirarem**, em até 30 dias. Eliminação imediata inclusive das cópias
é operação manual no provedor.

**Não prometa eliminação instantânea e total. Seria falso.** A redação honesta é: exclusão do ambiente
de produção em «PRAZO» e desaparecimento completo das cópias em até 30 dias.

---

## 9. Direitos dos titulares

O contrato deve registrar o que o sistema já entrega sozinho, para a CONTRATANTE saber com o que pode
contar ao responder um funcionário:

| Direito | Como é atendido |
|---|---|
| Confirmação e acesso | botão **Baixar meus dados**, em Perfil, sem depender de pedido ao administrador |
| Portabilidade | o mesmo arquivo, em formato aberto |
| Correção | o administrador da empresa corrige na tela de Usuários |
| Eliminação | por prazo automático, ou pelo procedimento de encerramento |
| Informação sobre compartilhamento | aviso de privacidade público, com a seção "Onde os dados ficam" |

Uma observação que vale cláusula: **o detalhamento dos registros de acesso (a lista de IPs) não vai no
arquivo baixado.** O titular é informado de que o registro existe, com quantidade e período, e o
detalhe é fornecido sob o sigilo que o Marco Civil (art. 10) exige.

**Revogação de consentimento não se aplica** e o contrato não deve criar essa expectativa: o
tratamento não se apoia em consentimento, e sim em execução de contrato e obrigação legal.

---

## 10. Segurança: o que pode ser afirmado

Tudo abaixo foi verificado no sistema. Nada aqui é aspiração.

- Senha guardada apenas como resumo criptográfico, nunca em texto legível.
- Acesso por conexão criptografada, obrigatória.
- Sessão encerrada automaticamente após 30 minutos sem uso.
- Troca de senha encerra as demais sessões abertas com a senha antiga.
- Bloqueio temporário após tentativas de senha erradas: 5 falhas travam por 1 minuto, 10 por 5
  minutos, 15 por 15 minutos.
- Recuperação de senha por link temporário de uso único, com validade de 1 hora. A senha nunca
  trafega por e-mail.
- Isolamento entre clientes em duas camadas, uma na aplicação e outra no próprio banco de dados, com
  verificação automática que reprova a publicação de código que escape do escopo.
- Permissão verificada no servidor em cada operação, não apenas na tela.
- Banco de dados sem porta exposta à internet.
- Anexos de nota fiscal privados, entregues apenas a quem tem acesso à empresa, com validação de tipo
  e de conteúdo do arquivo.
- Cópia de segurança diária, criptografada, com teste de restauração.
- Vigilância externa automática: disponibilidade verificada a cada 5 minutos e erro de sistema
  reportado a cada 15 minutos.

---

## 11. O que o contrato **não** pode prometer

Tão importante quanto a lista anterior. Nada disto existe:

- **Disponibilidade garantida com percentual (SLA de 99,x%).** Não há redundância nem contrato de
  nível de serviço com o provedor de hospedagem que sustente o número. Prometer percentual sem isso é
  criar obrigação que não se consegue cumprir. Se o contrato precisar falar de disponibilidade, fale
  em **esforço e janela de atendimento**, não em percentual.
- **Plantão 24 horas.** A vigilância automática funciona 24 horas e avisa a CONTRATADA, mas o
  **atendimento** segue o horário comercial combinado. Se o contrato citar o monitoramento, precisa
  trazer essa ressalva junto, senão vira promessa de resposta de madrugada.
- **Autenticação em dois fatores.** Não existe.
- **Plano documentado de resposta a incidente de segurança.** Ainda não existe (é a pendência nº 3 do
  registro de tratamento de dados). O contrato deve prever o **dever de comunicar** incidente, sem
  prometer um procedimento formalizado que ainda não foi escrito.
- **Certificação, selo ou auditoria de segurança de terceiros.** Não existe nenhuma.
- **Recuperação de dado apagado pelo próprio cliente** além do que a cópia de segurança de 30 dias
  alcança.
- Qualquer função da lista de exclusões da seção 6 do briefing da proposta comercial: PDV, nota
  fiscal, integração com balança, leitura automática de XML, controle de vendas ou financeiro, alerta
  de validade, aplicativo instalável.

---

## 12. Comunicação de incidente

O art. 48 da LGPD obriga comunicar a ANPD e o titular quando houver incidente com risco relevante.
Como a CONTRATANTE é a controladora, **é ela quem comunica a ANPD**.

Logo, a obrigação da CONTRATADA no contrato é: **comunicar a CONTRATANTE**, em prazo definido, ao
tomar conhecimento de incidente que envolva os dados dela, com as informações que tiver.

Defina o prazo: «PRAZO, ex.: em até 48 horas do conhecimento».

O que o sistema oferece para investigar: log técnico com IP e horário por 180 dias, histórico de
atividades por 5 anos, e o registro de todo acesso em modo suporte.

---

## 13. Condições comerciais

Não saem do sistema. São decisão da CONTRATADA e precisam ser preenchidas a cada contrato. Mantenha a
mesma lista do briefing da proposta comercial, para os dois documentos não divergirem:

| Item | A definir |
|---|---|
| Valor da implantação | «VALOR» |
| Valor da mensalidade | «VALOR» |
| Vigência e renovação | «PRAZO E FORMA» |
| Período de teste sem custo | «PRAZO» |
| Forma e data de pagamento | «FORMA E DIA» |
| Índice e periodicidade do reajuste | «ÍNDICE» |
| Multa e juros por atraso | «PERCENTUAIS» |
| Suspensão do acesso por inadimplência | «A PARTIR DE QUANTOS DIAS», e com quantos dias de aviso prévio |
| Horário e canal de suporte | «DIAS, HORÁRIOS», WhatsApp (47) 99154-0607 |
| Prazo de resposta do suporte | «PRAZO, dentro do horário de atendimento» |
| Prazo de aviso para cancelamento | «PRAZO» |
| Multa por rescisão antecipada | «SE HOUVER» |
| Limitação de responsabilidade | «TETO, decisão jurídica» |
| Foro | «COMARCA» |

Uma cláusula que costuma faltar e importa aqui: **o que acontece com o acesso quando o pagamento
atrasa.** O sistema permite suspender uma empresa, e a suspensão bloqueia o acesso de todos os
usuários dela. Se o contrato não disser a partir de quando isso ocorre e com quanto aviso, a
suspensão vira conflito.

---

## 14. Anexos que o contrato deve referenciar

- **Aviso de privacidade**, disponível publicamente no endereço do sistema, com data da última
  revisão. O contrato deve referenciá-lo, não reproduzi-lo: duplicar o texto criaria duas versões que
  divergem na primeira alteração.
- **Manual do usuário**, entregue na implantação.
- **Proposta comercial aceita**, que define escopo e valores.

---

## 15. O que este briefing **não** define

- Valores, prazos e percentuais comerciais (seção 13).
- A redação jurídica final de responsabilidade, limitação, garantia e foro.
- A escolha do instrumento de transferência internacional do art. 33.
- Qualquer cláusula sobre a administração da plataforma (cadastro de empresas, cobranças, logs
  técnicos). Isso é do fornecedor, não do cliente, e não entra no contrato dele.
