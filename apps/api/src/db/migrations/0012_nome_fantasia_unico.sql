-- Nome fantasia único entre empresas ativas. Regra de operação, não do mundo real: ver
-- docs/decisoes-arquiteturais.md antes de mexer.
--
-- O bloco abaixo existe para um banco com duplicados não falhar com a mensagem crua do Postgres.
DO $$
DECLARE
  duplicados text;
BEGIN
  SELECT string_agg(nome, ', ') INTO duplicados
  FROM (
    SELECT lower(trim("name")) AS nome
    FROM "companies"
    WHERE "deleted_at" IS NULL
    GROUP BY 1
    HAVING count(*) > 1
  ) AS repetidos;

  IF duplicados IS NOT NULL THEN
    RAISE EXCEPTION
      'Existem empresas ativas com o mesmo nome fantasia: %. Renomeie ou desative as repetidas antes de aplicar esta migração.',
      duplicados;
  END IF;
END $$;--> statement-breakpoint
-- `lower(trim(...))`: para quem lê a lista, "Frutaria Rincão" e "frutaria rincão  " são o mesmo nome.
CREATE UNIQUE INDEX "companies_name_active_unique"
  ON "companies" (lower(trim("name")))
  WHERE "deleted_at" IS NULL;
