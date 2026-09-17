CREATE TYPE "subscription_status" AS ENUM ('teste', 'ativa', 'atrasada', 'cancelada');--> statement-breakpoint
-- Sem coluna de empresa de propósito: é lida na tela de cadastro, por quem ainda não tem empresa.
CREATE TABLE "plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "monthly_amount" numeric(12, 2) NOT NULL,
  "trial_days" integer NOT NULL,
  "stripe_price_id" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Duas políticas: preço é público, mexer no preço não é. Sem a segunda, o `USING (true)` da leitura
-- valeria também para UPDATE e qualquer empresa reescreveria o próprio preço.
CREATE POLICY "plans_leitura" ON "plans" FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY "plans_escrita_plataforma" ON "plans"
  USING ("app_plataforma"())
  WITH CHECK ("app_plataforma"());--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "subscription_status" "subscription_status" DEFAULT 'ativa' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trial_ends_on" date;--> statement-breakpoint
-- Data do aceite do aviso de privacidade: caixa marcada sem rastro não prova nada depois.
ALTER TABLE "companies" ADD COLUMN "privacy_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_plan_id_plans_id_fk"
  FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- O padrão 'ativa' é o que vale para as empresas que já existem: elas não podem acordar em teste.
CREATE INDEX "companies_subscription_idx" ON "companies" USING btree ("subscription_status","trial_ends_on");--> statement-breakpoint
-- Semente de instalação nova. Num banco que já migrou, trocar o preço é UPDATE, não migração nova.
INSERT INTO "plans" ("name", "description", "monthly_amount", "trial_days")
VALUES ('Mensal', 'Acesso completo ao sistema, sem limite de produtos nem de usuários.', 99.90, 15);
