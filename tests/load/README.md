# Teste de carga

O cenário `read-flow.js` mede o fluxo autenticado de leitura mais comum sem alterar estoque ou poluir dados. Cada
usuário virtual alterna entre sessão, dashboard, estoque, entradas, movimentações e relatório por categoria.

## Segurança

- Rode preferencialmente em ambiente local ou homologação com dados descartáveis.
- O script recusa destinos remotos por padrão. Nunca use produção durante horário de operação.
- Para homologação remota, confirme autorização com `ALLOW_REMOTE_LOAD_TEST=true` e forneça credenciais próprias.
- O login acontece uma vez no `setup`, evitando que o rate limit e o Turnstile sejam o objeto involuntário do teste.
- Em `development`/`test`, somente o agente exato `HortiERP-Load-Test/1.0` é ignorado pelo rate limit global para que
  um único container consiga representar vários clientes. Essa exceção é desativada pelo código quando
  `NODE_ENV=production`; o rate limit de produção permanece intacto.

## Execução local

Com os containers e o seed de desenvolvimento ativos:

```bash
LOAD_PROFILE=smoke sh scripts/run-load-test.sh
LOAD_PROFILE=baseline sh scripts/run-load-test.sh
LOAD_PROFILE=stress sh scripts/run-load-test.sh
```

Perfis:

- `smoke`: chega a 5 usuários virtuais em 40 segundos; valida configuração.
- `baseline`: chega gradualmente a 30 usuários em 3 minutos; referência inicial recomendada.
- `stress`: chega a 80 usuários em 5 minutos; identifica o início da degradação.

Critérios de aprovação:

- Mais de 99% dos checks aprovados.
- Menos de 1% de requisições HTTP com falha.
- 95% das respostas abaixo de 750 ms.
- 99% das respostas abaixo de 1,5 segundo.

O comando termina com código diferente de zero quando um limite é violado e salva o resumo JSON em
`tests/load/results/`.

## Homologação remota

```bash
BASE_URL=https://homologacao.exemplo.com \
ALLOW_REMOTE_LOAD_TEST=true \
LOAD_PROFILE=baseline \
LOAD_TEST_EMAIL=operador-carga@exemplo.com \
LOAD_TEST_PASSWORD='senha-exclusiva' \
LOAD_TEST_TURNSTILE_TOKEN='token-aceito-no-ambiente' \
sh scripts/run-load-test.sh
```

Se o ambiente usar Turnstile real, prepare um mecanismo autorizado de teste no ambiente de homologação; não desative
a proteção em produção.
