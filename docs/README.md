# Documentação

Documentação técnica do projeto:

- [Modelo de dados](./modelo-de-dados.md) — tabelas, relacionamentos, enums, empresas e cobranças manuais.
- [Decisões arquiteturais](./decisoes-arquiteturais.md) — multiempresa, autenticação, papéis, super_admin/impersonação, consulta redundante de CEP, soft delete, planilhas, data do fato x data do lançamento e mensagens de erro em português.
- [Fluxos de negócio](./fluxos-de-negocio.md) — estoque, importação por planilha, correção de lançamentos, dashboard, empresas-cliente e controle manual de cobranças.
- [Deploy de produção](./deploy-producao.md) — imagens, HTTPS, variáveis, migrations, primeiro acesso e rollback.

Mantenha estes documentos atualizados conforme o sistema evolui — decisões e fluxos que mudarem aqui tendem a ficar desatualizados rápido se não forem revisados junto com o código.

## Não é documentação técnica

- [Briefing do manual do usuário](./briefing-manual-do-usuario.md) — não descreve o sistema para quem desenvolve, e sim
  reúne o que um modelo de linguagem precisa saber para redigir o **manual entregue ao cliente**. Fica aqui porque
  precisa ser revisado junto com os fluxos: mudança de comportamento que afeta o usuário final tem de aparecer nos dois
  lugares. Ele deliberadamente **omite** as telas da plataforma (empresas, cobranças, logs técnicos), que não pertencem
  ao cliente.
