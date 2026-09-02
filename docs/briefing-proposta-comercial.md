# Briefing da proposta comercial

Este arquivo não descreve o sistema para quem desenvolve — ele reúne o que a **proposta comercial**
precisa dizer, com os números já conferidos no código, para que a proposta possa ser gerada ou
revisada sem ninguém precisar abrir o repositório.

**Como usar:** cole este arquivo junto com a proposta atual e peça a revisão. Se for gerar de zero,
ele é a fonte da verdade do que o sistema faz.

**Regra de manutenção:** mudança que o cliente percebe entra aqui na mesma entrega. Se este arquivo
ficar velho, a proposta seguinte nasce errada — foi por isso que ele existe em vez de uma lista de
correções solta.

---

## 1. Tom

Linguagem de dono de verdureira. Nada de "RLS", "criptografia AES", "multiempresa", "row level
security". Cada item de segurança precisa responder *"e daí, o que isso muda pra mim?"*.

Onde houver limite ou ressalva, dizer. A proposta ganha credibilidade pela seção do que **não** está
incluído, não perde.

---

## 2. O que o sistema faz

Lista completa do que pode ser prometido. Nada fora daqui existe.

**Estoque.** Consulta do saldo de qualquer produto, com destaque automático e filtro para o que está
com estoque baixo. Ajuste de estoque com motivo obrigatório, registrado no histórico com quem fez,
quando e qual era o saldo antes. Tela de histórico por produto, movimento por movimento, com o saldo
resultante de cada um.

**Aviso de estoque baixo em qualquer tela.** Um sino no alto da tela mostra, com um número em
vermelho, quantos produtos estão sem estoque e quantos caíram abaixo do mínimo cadastrado. Aparece
para os três papéis e em todas as telas, e leva direto para a lista completa. Duas ressalvas que
precisam ser ditas para a promessa não crescer sozinha:

- **É aviso dentro do sistema, não notificação por e-mail, WhatsApp ou celular.** A pessoa vê quando
  está com o sistema aberto. Não prometa alerta que chega sozinho para quem está fora. Dentro do
  sistema, porém, o número se corrige sozinho: repôs a mercadoria e lançou a entrada, o alerta some
  sem precisar recarregar a tela.
- **Só avisa antes de acabar nos produtos que tiverem estoque mínimo cadastrado.** Sem esse campo
  preenchido, o sino avisa quando o produto zera. Vale como argumento de implantação, não como
  ressalva escondida: preencher o mínimo é parte de configurar o sistema direito.

**Entradas.** Lançamento do que o fornecedor entregou — produtos, quantidade e custo — com o estoque
atualizado na hora. Anexo do arquivo da nota (XML, PDF ou foto). Correção posterior dos dados
fiscais (número, série, chave de acesso, data de emissão, valor, fornecedor) sem mexer no estoque já
lançado.

**Perdas.** Registro com motivo (vencido, avariado, roubo/furto, erro operacional, outro). Sai do
estoque na hora e guarda o valor do momento. Motivo e observação podem ser corrigidos; quantidade ou
produto errados exigem cancelar a perda — a quantidade volta ao estoque sozinha, a perda sai dos
relatórios e do painel, e fica registrado quem cancelou e por quê.

**Cadastros.** Produto, categoria e unidade de medida. Os três podem ser **inativados** quando a loja
para de usar: saem das opções na hora de cadastrar produto novo e o que já usava eles continua intacto.
O sistema não deixa excluir categoria ou unidade que esteja em algum produto, para o cadastro não ficar
apontando para o vazio.

**Código de barras.** O produto tem campo de código de barras, preenchido na tela ou pela importação de
planilha, e a busca da tela de Produtos encontra por nome, por SKU e por código de barras. Na prática
isso faz um leitor comum de USB funcionar ali: ele se comporta como teclado, então basta clicar na busca
e bipar. Ressalva que precisa ser dita junto: a busca da tela de **Estoque** procura só por nome, então
bipar não funciona lá.

**Importação.** Carga de produtos por planilha, com estoque inicial, conferência linha por linha antes
de confirmar (o que vai entrar, o que vai ser criado, o que está sem custo) e
recusa total se qualquer linha tiver problema (não importa metade). Produto sem custo preenchido
aparece valendo R$ 0,00 nos relatórios até o valor ser informado, e o sistema avisa antes de
confirmar.

**Painel e relatórios.** Painel com produtos em estoque baixo, valor parado em estoque, valor perdido
no período e maiores perdas — os mesmos produtos em estoque baixo que o sino resume no alto da tela. Relatórios de entradas, de perdas e de estoque por categoria, por
período, com botão de gerar PDF.

**Exportação.** Botão de baixar planilha nas telas de Produtos, Estoque, Movimentações de estoque,
Entradas, Perdas e Histórico de atividades — já com os filtros aplicados.

**Acessos.** Três papéis, descritos na seção 4.

**Dados pessoais.** Aviso de privacidade público em `/privacidade`, com link no rodapé de todas as
telas e data da última revisão — qualquer pessoa lê antes de entrar, inclusive quem não tem conta.
E, em **Perfil**, qualquer usuário tem o botão **Baixar meus dados**, que entrega o cadastro dele e o
histórico das ações dele sem depender de pedir para ninguém.

---

## 3. Números e limites — conferidos no código

| Item | Valor |
|---|---|
| Anexos por entrada de mercadoria | 3 |
| Tamanho por arquivo anexado | 10 MB |
| Produtos por importação de planilha | 2.000 |
| Itens por entrada de mercadoria | 200 |
| Caracteres em nome de cadastro | 120 |
| Caracteres em observação de perda | 500 |
| Caracteres em observação de entrada | 2.000 |
| Quantidade por lançamento | 999.999,999 |
| Preço unitário | R$ 9.999.999,99 |
| Período máximo por consulta no painel e nos gráficos | 90 dias |
| Sessão fecha por inatividade | 30 minutos |
| Retenção da cópia de segurança | 30 dias |
| Registro técnico de acesso (data, hora, IP) | 180 dias |
| Histórico de atividades | 5 anos |
| Nome e e-mail de usuário excluído | anonimizados após 5 anos |

---

## 4. Permissões

| Papel | Pode |
|---|---|
| Operador | lançar entrada de mercadoria e perda |
| Gerente | o do operador, mais cadastrar produto, categoria e unidade, corrigir e cancelar perda, corrigir dados da nota e ajustar estoque |
| Administrador | tudo do gerente, mais gerenciar usuários e ver o histórico de atividades |

Os três **veem as mesmas informações do negócio** — painel, estoque, relatórios e o sino de aviso de
estoque baixo. O que muda é o que cada um pode alterar.

---

## 5. Segurança e LGPD

O que pode ser afirmado:

- **Acesso protegido**, com sessão que fecha sozinha após 30 minutos sem uso.
- **Trocar a senha derruba as outras sessões.** Quem trocou continua trabalhando sem interrupção;
  qualquer outra sessão aberta com a senha antiga cai na hora. Serve para cortar o acesso de quem sabia
  a senha antiga, e vale também quando o administrador troca a senha de um funcionário.
- **Bloqueio temporário por tentativa de senha errada.** Na mesma conta, 5 falhas seguidas travam o
  acesso por 1 minuto, 10 falhas por 5 minutos e 15 falhas por 15 minutos. A contagem zera 15 minutos
  depois da última tentativa, e um acerto limpa tudo.
- **Isolamento entre clientes em duas camadas:** uma no sistema e outra no próprio banco de dados. A
  segunda existe para o caso de a primeira falhar — mesmo princípio de ter freio e freio de mão.
- **Cópia de segurança diária, criptografada**, guardada por 30 dias, com uma cópia **fora do
  servidor**: se a máquina do sistema for perdida por inteiro, os dados continuam existindo.
- **Vigilância externa, 24 horas por dia.** Um serviço independente verifica o sistema de fora a cada
  5 minutos e avisa por e-mail se ele sair do ar. Um segundo aviso, a cada 15 minutos, reporta erro de
  servidor já dizendo qual tela falhou. O backup diário e a limpeza semanal também avisam sozinhos se
  deixarem de rodar.
- **Limpeza automática**, semanal, do que passou dos prazos da tabela da seção 3. Guardar dado para
  sempre é risco, não zelo — e os prazos não são escolha: 180 dias é o mínimo que a lei exige de quem
  oferece serviço na internet (Marco Civil, art. 15), e 5 anos acompanha o prazo de fiscalização
  tributária.
- **Histórico de quem cadastrou, alterou ou excluiu** produtos, categorias, unidades e usuários, com
  data e hora. O nome do item continua aparecendo mesmo depois de excluído.
- **Apagamento definitivo no cancelamento**, incluindo os arquivos de nota anexados.

### Transferência internacional — precisa estar na proposta

A cópia fora do servidor fica nos **Estados Unidos**. Pela LGPD isso é transferência internacional de
dados e o cliente tem direito de saber. Redação sugerida:

> A cópia de segurança é enviada criptografada para um armazenamento localizado nos Estados Unidos.
> O arquivo é fechado com uma senha que fica só comigo — o provedor guarda um arquivo que ele não
> consegue abrir. O sistema em si, com os seus dados do dia a dia, roda em servidor no Brasil
> (São Paulo).

Não enfeitar e não omitir. É o tipo de informação que, faltando, vira problema justamente com o
cliente que lê contrato.

### Controlador e operador

Vale uma linha: pela LGPD o **cliente é o controlador** dos dados (é ele que decide o que cadastrar e
para quê) e o **prestador é o operador** (trata os dados em nome dele, seguindo as instruções dele).
A lei prevê responsabilidade dos dois, e deixar isso claro desde a proposta evita confusão depois.

### Ressalvas que precisam aparecer

- O apagamento no cancelamento **não alcança as cópias de segurança já criadas** — elas seguem
  contendo os dados até expirarem, em até 30 dias. Não prometer apagamento instantâneo e total.
- O histórico de atividades é guardado por **5 anos**, não para sempre.
- Para **usuário** excluído, o nome é substituído após 5 anos. A permanência do nome vale para
  produto, categoria e unidade.
- A vigilância avisa **o prestador**, e não é plantão 24 horas. Se a proposta citar o monitoramento,
  precisa deixar claro que o atendimento segue o horário de suporte combinado, senão a frase vira
  promessa de resposta de madrugada.
- A vigilância pega queda e erro de servidor. Não pega conta errada que devolve um número com
  aparência normal, nem lentidão. Silêncio quer dizer "nenhuma tela quebrou", não "está tudo certo".

---

## 6. O que não prometer

Não existe hoje, nem como "em breve":

- Autenticação em dois fatores ou código por SMS
- Plano documentado de resposta a incidente de segurança
- Integração com balança ou maquininha de cartão
- Leitura automática da nota fiscal (o arquivo é guardado; os produtos não entram sozinhos a partir
  dele)
- Caixa (PDV), cupom fiscal, nota fiscal eletrônica de venda
- Controle de vendas, contas a pagar ou a receber
- Aplicativo instalável — é um site, aberto pelo navegador do celular ou do computador
- Aviso de estoque baixo por e-mail, SMS, WhatsApp ou notificação no celular — o aviso é o sino
  dentro do sistema, visto por quem está com ele aberto (ver seção 2)
- Aviso de validade ou vencimento de produto. O sistema **não guarda data de validade nem lote**:
  "vencido" existe só como motivo de perda, registrado depois que a perda aconteceu. Prometer alerta
  de vencimento é prometer o que não existe, e é a confusão mais provável de quem ler "alertas" numa
  proposta de hortifruti
- Certificação, selo ou auditoria de segurança de terceiros

Sobre **leitor de código de barras** a redação precisa de cuidado, porque os dois extremos estão
errados. Integração não existe e não pode ser prometida. Mas o campo existe no produto e a busca da
tela de Produtos encontra por ele, então um leitor de USB funciona ali. Negar por completo subvende o
sistema; prometer "leitor de código de barras" sem qualificar é exagero. A redação honesta está na
seção 2.

### O manual prometido na implantação

A proposta promete, na implantação, "material escrito de apoio pra consultar depois". Esse manual
existe, foi gerado em 25/08/2026 a partir de `briefing-manual-do-usuario.md`, e a promessa está
coberta. Duas ressalvas: a versão gerada naquela data **não trouxe a inativação de cadastro** nem a
trava de exclusão de cadastro em uso, e não conhece as proteções de senha que entraram depois. Antes
de entregar ao primeiro cliente, regere o manual a partir do briefing atualizado.

---

## 7. O que este arquivo **não** define

Valores, prazos e condições comerciais não saem do código e não estão aqui: taxa de implantação,
mensalidade, duração do teste gratuito, horário e franquia de suporte, forma de pagamento, índice de
reajuste, multa por atraso, prazo de aviso de cancelamento, garantia e foro. Isso é decisão do
prestador e deve ser mantido como está na proposta vigente.

---

## 8. O que revisar na proposta em vigor

A proposta de 27/08/2026 já incorporou a revisão anterior: aviso de privacidade, botão Baixar meus
dados, limpeza automática, cópia fora do servidor com a transferência internacional declarada,
isolamento em duas camadas, apagamento no cancelamento, a perda cancelada guardada por 5 anos e o nome
de usuário excluído anonimizado após 5 anos. Nada disso precisa de mexida.

Falta o que entrou depois. Para revisar a proposta atual, é isto:

**Acrescentar na lista do que está incluído:**

1. Inativar cadastro sem apagar (produto, categoria e unidade), e o bloqueio de exclusão de categoria
   ou unidade que ainda esteja em uso. Ver seção 2.
2. Código de barras no produto, com a busca da tela de Produtos encontrando por ele. Ver seção 2 para a
   redação, que precisa citar a ressalva da tela de Estoque.
3. O sino de aviso de estoque baixo em todas as telas, com as duas ressalvas da seção 2 (é aviso
   dentro do sistema, e depende do estoque mínimo estar cadastrado).

**Acrescentar na lista de segurança:**

4. Trocar a senha derruba as outras sessões.
5. Bloqueio temporário depois de várias tentativas de senha errada.
6. Vigilância externa 24 horas, com aviso automático de queda e de erro. Precisa vir acompanhada da
   ressalva de horário de suporte, descrita na seção 5.

**Corrigir:**

7. A linha que nega leitor de código de barras. Hoje ela diz mais do que a verdade. Ver seção 6.
8. Se a proposta em vigor já falava em "alertas" de forma solta, prender o termo ao que existe: aviso
   de estoque baixo dentro do sistema. Não pode ficar dando a entender vencimento nem aviso externo.

**Decidir antes de mandar para cliente:**

9. O manual do usuário existe, mas a versão de 25/08 está desatualizada. Regerar a partir do
   `briefing-manual-do-usuario.md` antes de entregar ao primeiro cliente. Ver seção 6.

---

## 9. Verificação de 28/08/2026

Todos os números da seção 3 foram conferidos contra o código nesta data, um por um, e batem. Também foi
conferido que a tela de Cobranças é exclusiva do super admin da plataforma, ou seja, não é
funcionalidade do cliente e não entra na proposta.

## 10. Verificação de 02/09/2026

Entrou o sino de aviso de estoque baixo, conferido no código nesta data: vale para os três papéis,
aparece em todas as telas, conta produto zerado e produto abaixo do mínimo cadastrado, e não conta
perda do dia. O sino também existe do lado da plataforma, mostrando cobranças atrasadas — como a tela
de Cobranças, **não é funcionalidade do cliente e não entra na proposta**.

Nenhum número da seção 3 mudou. Continua valendo que o sistema **não guarda data de validade nem
lote**, então nada relacionado a vencimento pode ser prometido (seção 6).
