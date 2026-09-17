-- Contagem de estoque (balanço): sessão que junta os produtos a conferir, recebe o que foi contado
-- na loja e só vira ajuste no encerramento. Enquanto está em andamento a API não devolve o saldo do
-- sistema, para quem conta não copiar o número da tela. Ver docs/fluxos-de-negocio.md.
CREATE TYPE "stock_count_status" AS ENUM ('em_andamento', 'em_conferencia', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid,
	"status" "stock_count_status" DEFAULT 'em_andamento' NOT NULL,
	"notes" text,
	"cancel_reason" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);--> statement-breakpoint
-- `previous_quantity` e `unit_cost` nascem vazios e são congelados no encerramento, com o saldo e o
-- custo do instante em que o ajuste foi aplicado. É isso que mantém o relatório de divergência
-- honesto meses depois, quando o estoque e o custo do produto já mudaram.
CREATE TABLE "stock_count_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_count_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"counted_quantity" numeric(12, 3),
	"counted_at" timestamp with time zone,
	"counted_by" uuid,
	"previous_quantity" numeric(12, 3),
	"unit_cost" numeric(12, 2)
);--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_category_id_categories_id_fk"
  FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_stock_count_id_stock_counts_id_fk"
  FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_counts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_counts_company_started_at_idx" ON "stock_counts" ("company_id", "started_at");--> statement-breakpoint
-- Uma contagem aberta por empresa. Duas ao mesmo tempo alcançariam o mesmo produto e a segunda a
-- encerrar desfaria o ajuste da primeira; o banco recusa antes de a regra da aplicação falhar.
CREATE UNIQUE INDEX "stock_counts_uma_aberta_por_empresa" ON "stock_counts" ("company_id")
  WHERE "status" IN ('em_andamento', 'em_conferencia');--> statement-breakpoint
CREATE UNIQUE INDEX "stock_count_items_unique" ON "stock_count_items" ("stock_count_id", "product_id");--> statement-breakpoint
CREATE INDEX "stock_count_items_product_idx" ON "stock_count_items" ("product_id");--> statement-breakpoint
ALTER TABLE "stock_counts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "stock_counts_empresa" ON "stock_counts"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "stock_count_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Sem coluna de empresa: o vínculo é a contagem, igual a stock_entry_items. A subconsulta também
-- passa pela política de stock_counts, então sob escopo de empresa já só enxerga contagens próprias.
CREATE POLICY "stock_count_items_empresa" ON "stock_count_items"
  USING ("app_plataforma"() OR EXISTS (
    SELECT 1 FROM "stock_counts" WHERE "stock_counts"."id" = "stock_count_items"."stock_count_id"
      AND "stock_counts"."company_id" = "app_empresa_atual"()
  ))
  WITH CHECK ("app_plataforma"() OR EXISTS (
    SELECT 1 FROM "stock_counts" WHERE "stock_counts"."id" = "stock_count_items"."stock_count_id"
      AND "stock_counts"."company_id" = "app_empresa_atual"()
  ));
