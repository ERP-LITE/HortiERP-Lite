-- Liga o código que o fornecedor usa na nota ao produto da loja. Existe porque o `cProd` da NF-e é o
-- código de quem vendeu, não o de quem compra, e não há como adivinhar a correspondência.
-- Aprendida ao confirmar a entrada: ver docs/decisoes-arquiteturais.md.
CREATE TABLE "supplier_product_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_document" text NOT NULL,
	"supplier_code" text NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);--> statement-breakpoint
ALTER TABLE "supplier_product_codes" ADD CONSTRAINT "supplier_product_codes_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_product_codes" ADD CONSTRAINT "supplier_product_codes_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Índice simples porque o código já entra normalizado (sem espaços e em maiúsculas): fornecedor que
-- escreve "a01" numa nota e "A01" na seguinte é o mesmo item, e normalizar na borda evita índice por
-- expressão, que o ON CONFLICT não alcança bem.
CREATE UNIQUE INDEX "supplier_product_codes_unique"
  ON "supplier_product_codes" ("company_id", "supplier_document", "supplier_code");--> statement-breakpoint
CREATE INDEX "supplier_product_codes_product_idx" ON "supplier_product_codes" ("product_id");--> statement-breakpoint
ALTER TABLE "supplier_product_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "supplier_product_codes_empresa" ON "supplier_product_codes"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());
