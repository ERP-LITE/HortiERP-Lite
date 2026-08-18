ALTER TABLE "stock_movements" ADD COLUMN "movement_date" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Movimentações antigas não tinham data de negócio: a data do lançamento era a única que existia.
UPDATE "stock_movements" SET "movement_date" = "created_at";--> statement-breakpoint
CREATE INDEX "stock_movements_company_movement_date_idx" ON "stock_movements" USING btree ("company_id","movement_date");
