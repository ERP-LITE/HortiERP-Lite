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

**Entradas.** Lançamento do que o fornecedor entregou — produtos, quantidade e custo — com o estoque
atualizado na hora. Anexo do arquivo da nota (XML, PDF ou foto). Correção posterior dos dados
fiscais (número, série, chave de acesso, data de emissão, valor, fornecedor) sem mexer no estoque já
lançado.

**Perdas.** Registro com motivo (vencido, avariado, roubo/furto, erro operacional, outro). Sai do
estoque na hora e guarda o valor do momento. Motivo e observação podem ser corrigidos; quantidade ou
produto errados exigem cancelar a perda — a quantidade volta ao estoque sozinha, a perda sai dos
relatórios e do painel, e fica registrado quem cancelou e por quê.

**Cadastros.** Produto, categoria e unidade de medida. Categoria e unidade podem ser **inativadas**
quando a loja para de usar: saem das opções de produto novo e os produtos antigos continuam intactos. O
sistema não deixa excluir categoria ou unidade que esteja em algum produto, para o cadastro não ficar
apontando para o vazio.

**Importação.** Carga de produtos por planilha, com estoque inicial, conferência linha por linha antes
de confirmar (o que vai entrar, o que vai ser criado, o que está sem custo) e
recusa total se qualquer linha tiver problema (não importa metade). Produto sem custo preenchido
aparece valendo R$ 0,00 nos relatórios até o valor ser informado, e o sistema avisa antes de
confirmar.

**Painel e relatórios.** Painel com produtos em estoque baixo, valor parado em estoque, valor perdido
no período e maiores perdas. Relatórios de entradas, de perdas e de estoque por categoria, por
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

Os três **veem as mesmas informações do negócio** — painel, estoque, relatórios. O que muda é o que
cada um pode alterar.

---

## 5. Segurança e LGPD

O que pode ser afirmado:

- **Acesso protegido**, com sessão que fecha sozinha após 30 minutos sem uso.
- **Isolamento entre clientes em duas camadas:** uma no sistema e outra no próprio banco de dados. A
  segunda existe para o caso de a primeira falhar — mesmo princípio de ter freio e freio de mão.
- **Cópia de segurança diária, criptografada**, guardada por 30 dias, com uma cópia **fora do
  servidor**: se a máquina do sistema for perdida por inteiro, os dados continuam existindo.
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

---

## 6. O que não prometer

Não existe hoje, nem como "em breve":

- Autenticação em dois fatores ou código por SMS
- Plano documentado de resposta a incidente de segurança
- Integração com balança, leitor de código de barras ou maquininha
- Leitura automática da nota fiscal (o arquivo é guardado; os produtos não entram sozinhos a partir
  dele)
- Caixa (PDV), cupom fiscal, nota fiscal eletrônica de venda
- Controle de vendas, contas a pagar ou a receber
- Aplicativo instalável — é um site, aberto pelo navegador do celular ou do computador
- Certificação, selo ou auditoria de segurança de terceiros

---

## 7. O que este arquivo **não** define

Valores, prazos e condições comerciais não saem do código e não estão aqui: taxa de implantação,
mensalidade, duração do teste gratuito, horário e franquia de suporte, forma de pagamento, índice de
reajuste, multa por atraso, prazo de aviso de cancelamento, garantia e foro. Isso é decisão do
prestador e deve ser mantido como está na proposta vigente.

---

## 8. O que mudou desde a proposta de 25/08/2026

Para revisar uma proposta já escrita, é isto que precisa entrar ou ser corrigido:

**Acrescentar:** o aviso de privacidade em `/privacidade`; o botão **Baixar meus dados** no Perfil; a
limpeza automática de registros antigos; a cópia de segurança fora do servidor **com a
transferência internacional declarada**; o isolamento em duas camadas; o apagamento definitivo no
cancelamento.

**Acrescentar também:** a inativação de categoria e unidade e a conferência linha por linha da
importação.

**Corrigir:** o trecho que diz que na perda cancelada "nada é apagado" (hoje o registro é guardado
por 5 anos) e o que diz que o nome continua aparecendo depois de excluído (vale para produto,
categoria e unidade; para usuário há o prazo de 5 anos).
