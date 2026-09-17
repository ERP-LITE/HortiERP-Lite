# Documentação

Documentação técnica do projeto:

- [Modelo de dados](./modelo-de-dados.md) — tabelas, relacionamentos, enums, empresas e cobranças manuais.
- [Decisões arquiteturais](./decisoes-arquiteturais.md) — multiempresa e as duas camadas de isolamento (filtro na aplicação e RLS no banco), autenticação, papéis, super_admin/impersonação, consulta redundante de CEP, soft delete, planilhas, data do fato x data do lançamento, limites de tamanho dos campos, o sino de alertas como estado atual, mensagens de erro em português, o padrão de campo com erro (vermelho único, que some quando a pessoa corrige) e o cadastro público com período de teste.
- [Fluxos de negócio](./fluxos-de-negocio.md) — estoque, importação por planilha, correção de lançamentos, dashboard, alertas no cabeçalho, empresas-cliente e controle manual de cobranças.
- [Deploy de produção](./deploy-producao.md) — imagens, HTTPS, variáveis, migrations, primeiro acesso e rollback.

Mantenha estes documentos atualizados conforme o sistema evolui — decisões e fluxos que mudarem aqui tendem a ficar desatualizados rápido se não forem revisados junto com o código.

- [Registro das operações de tratamento de dados pessoais](./registro-de-tratamento-de-dados.md) — o inventário que o
  art. 37 da LGPD pede: qual dado pessoal o sistema guarda, onde, por quanto tempo, quem acessa e para onde vai. Serve
  também como insumo para o advogado redigir o contrato de operador e o aviso de privacidade. Cada afirmação foi
  conferida no código; a seção de pendências lista, sem maquiagem, o que ainda falta.

## Não é documentação técnica

- [Briefing do manual do usuário](./briefing-manual-do-usuario.md) — não descreve o sistema para quem desenvolve, e sim
  reúne o que um modelo de linguagem precisa saber para redigir o **manual entregue ao cliente**. Fica aqui porque
  precisa ser revisado junto com os fluxos: mudança de comportamento que afeta o usuário final tem de aparecer nos dois
  lugares. Ele deliberadamente **omite** as telas da plataforma (empresas, cobranças, logs técnicos), que não pertencem
  ao cliente. Os fatos foram conferidos contra o código em 24/08/2026, e o arquivo traz o endereço de acesso e o
  contato do suporte que o manual precisa citar — ao mudar comportamento visível ao usuário, corrija o briefing na
  mesma entrega.
- [Briefing do contrato](./briefing-contrato.md) — o que o **contrato de prestação de serviço** precisa
  cobrir, com os fatos já conferidos: o acesso de suporte que precisa de autorização expressa, as duas
  transferências internacionais, os prazos de guarda que o sistema executa sozinho e, principalmente, a
  lista do que o contrato **não** pode prometer (SLA com percentual, plantão 24 horas, dois fatores,
  procedimento de incidente escrito). O documento gerado a partir dele é **minuta e precisa de
  advogado**. Nasceu para resolver a pendência nº 1 do registro de tratamento de dados.
- [Briefing da proposta comercial](./briefing-proposta-comercial.md) — o que a **proposta enviada ao prospecto** precisa
  dizer, com os números conferidos no código (limites, prazos de retenção, permissões dos três papéis) e as ressalvas
  que precisam aparecer, incluindo as duas transferências internacionais (a cópia de segurança cifrada e o envio do
  e-mail de redefinição de senha). Segue a mesma regra do
  briefing do manual: mudança que o cliente percebe entra aqui na mesma entrega, senão a proposta seguinte nasce
  errada. **Não** define valores, prazos nem condições comerciais — isso não sai do código.
