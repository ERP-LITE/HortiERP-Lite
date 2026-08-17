ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
-- Pode falhar se duas contas ativas diferirem só pela caixa. Ver docs/deploy-producao.md.
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_active_unique" ON "users" USING btree (lower("email")) WHERE "users"."deleted_at" is null;
