-- Pedidos de redefinição de senha. A coluna guarda o SHA-256 do token, nunca o token: quem lê esta
-- tabela num dump ou num backup não consegue redefinir a senha de ninguém.
CREATE TABLE "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- CASCADE aqui, ao contrário do resto do schema: token é rastro de um pedido, não histórico. Some
-- junto com a conta, e some cedo.
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id","created_at");--> statement-breakpoint
-- A varredura da retenção corta por `expires_at`; sem este índice ela vira varredura de tabela.
CREATE INDEX "password_reset_tokens_expires_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Mesma política das demais tabelas por empresa. Na prática o fluxo inteiro roda em escopo de
-- plataforma, porque quem pede a redefinição ainda não tem sessão e portanto não tem empresa: o
-- `app_plataforma()` é o ramo que vale aqui, e a comparação por empresa existe para a tabela não
-- ficar de fora da rede se um dia alguma tela autenticada precisar ler estes registros.
CREATE POLICY "password_reset_tokens_empresa" ON "password_reset_tokens"
  USING ("app_plataforma"() OR "company_id" = "app_empresa_atual"())
  WITH CHECK ("app_plataforma"() OR "company_id" = "app_empresa_atual"());
