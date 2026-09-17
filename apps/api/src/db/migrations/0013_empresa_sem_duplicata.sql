-- Razão social, inscrição estadual e e-mail de contato, únicos entre empresas ativas. Telefone, nome
-- do contato e endereço ficam de fora de propósito: ver docs/decisoes-arquiteturais.md.
DO $$
DECLARE
  problema text;
BEGIN
  SELECT string_agg(descricao, '; ') INTO problema FROM (
    SELECT 'razão social repetida: ' || lower(trim("legal_name")) AS descricao
    FROM "companies" WHERE "deleted_at" IS NULL AND "legal_name" IS NOT NULL
    GROUP BY lower(trim("legal_name")) HAVING count(*) > 1
    UNION ALL
    SELECT 'inscrição estadual repetida: ' || lower(trim("state_registration"))
    FROM "companies" WHERE "deleted_at" IS NULL AND "state_registration" ~ '[0-9]'
    GROUP BY lower(trim("state_registration")) HAVING count(*) > 1
    UNION ALL
    SELECT 'e-mail de contato repetido: ' || lower(trim("contact_email"))
    FROM "companies" WHERE "deleted_at" IS NULL AND "contact_email" IS NOT NULL
    GROUP BY lower(trim("contact_email")) HAVING count(*) > 1
  ) AS repetidos;

  IF problema IS NOT NULL THEN
    RAISE EXCEPTION
      'Existem empresas ativas com dados repetidos (%). Corrija antes de aplicar esta migração.',
      problema;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_legal_name_active_unique"
  ON "companies" (lower(trim("legal_name")))
  WHERE "deleted_at" IS NULL AND "legal_name" IS NOT NULL;--> statement-breakpoint
-- Só com dígito: "Isento" é a ausência de inscrição escrita por extenso, e se repete.
CREATE UNIQUE INDEX "companies_state_registration_active_unique"
  ON "companies" (lower(trim("state_registration")))
  WHERE "deleted_at" IS NULL AND "state_registration" ~ '[0-9]';--> statement-breakpoint
CREATE UNIQUE INDEX "companies_contact_email_active_unique"
  ON "companies" (lower(trim("contact_email")))
  WHERE "deleted_at" IS NULL AND "contact_email" IS NOT NULL;
