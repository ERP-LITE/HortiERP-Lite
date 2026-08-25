-- Isolamento por empresa dentro do próprio banco. A empresa da sessão chega por uma variável de
-- sessão, definida pela API na conexão reservada da requisição. Sem ela, `app_empresa_atual()`
-- devolve NULL e a comparação nunca casa: a consulta volta vazia em vez de trazer dados de outra
-- empresa. Ver docs/decisoes-arquiteturais.md.
CREATE FUNCTION "app_empresa_atual"() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.empresa', true), '')::uuid $$;--> statement-breakpoint
-- Travessia legítima e declarada: login, validação de sessão, cobranças da plataforma, retenção e
-- manutenção. Ligada só dentro de `comEscopoDePlataforma`.
CREATE FUNCTION "app_plataforma"() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT coalesce(current_setting('app.plataforma', true), 'off') = 'on' $$;--> statement-breakpoint
ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "activity_logs_empresa" ON "activity_logs"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "categories_empresa" ON "categories"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "company_billings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "company_billings_empresa" ON "company_billings"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "losses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "losses_empresa" ON "losses"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "products_empresa" ON "products"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "stock_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "stock_entries_empresa" ON "stock_entries"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "stock_entry_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "stock_entry_attachments_empresa" ON "stock_entry_attachments"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "stock_movements_empresa" ON "stock_movements"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "system_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "system_logs_empresa" ON "system_logs"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "units_empresa" ON "units"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_empresa" ON "users"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "companies_empresa" ON "companies"
  USING ("app_plataforma"() OR "id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "id" = "app_empresa_atual"());--> statement-breakpoint
ALTER TABLE "stock_entry_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Sem coluna de empresa: o vínculo é a entrada. A subconsulta também passa pela política de
-- stock_entries, então sob escopo de empresa ela já só enxerga entradas próprias.
CREATE POLICY "stock_entry_items_empresa" ON "stock_entry_items"
  USING ("app_plataforma"() OR EXISTS (
    SELECT 1 FROM "stock_entries" WHERE "stock_entries"."id" = "stock_entry_items"."stock_entry_id"
      AND "stock_entries"."company_id" = "app_empresa_atual"()
  ))
  WITH CHECK ("app_plataforma"() OR EXISTS (
    SELECT 1 FROM "stock_entries" WHERE "stock_entries"."id" = "stock_entry_items"."stock_entry_id"
      AND "stock_entries"."company_id" = "app_empresa_atual"()
  ));