CREATE TYPE "public"."loss_reason" AS ENUM('vencido', 'avariado', 'roubo_furto', 'erro_operacional', 'outro');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('entrada', 'perda', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'gerente', 'operador', 'super_admin');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"document" text,
	"state_registration" text,
	"contact_name" text,
	"contact_email" text,
	"phone" text,
	"postal_code" text,
	"street" text,
	"address_number" text,
	"complement" text,
	"district" text,
	"city" text,
	"state" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'operador' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"barcode" text,
	"cost_price" numeric(12, 2),
	"sale_price" numeric(12, 2),
	"min_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"current_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "stock_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_name" text,
	"entry_date" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"invoice_number" text,
	"invoice_series" text,
	"invoice_access_key" text,
	"invoice_issued_at" timestamp with time zone,
	"invoice_total" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "stock_entry_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"stock_entry_id" uuid NOT NULL,
	"original_name" text NOT NULL,
	"stored_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "stock_entry_attachments_stored_name_unique" UNIQUE("stored_name")
);
--> statement-breakpoint
CREATE TABLE "stock_entry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_entry_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_cost" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "losses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_cost" numeric(12, 2),
	"reason" "loss_reason" NOT NULL,
	"notes" text,
	"loss_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "movement_type" NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"balance_after" numeric(12, 3) NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"actor_id" uuid,
	"actor_role" text,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"error_code" text,
	"error_message" text,
	"ip" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entry_attachments" ADD CONSTRAINT "stock_entry_attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entry_attachments" ADD CONSTRAINT "stock_entry_attachments_stock_entry_id_stock_entries_id_fk" FOREIGN KEY ("stock_entry_id") REFERENCES "public"."stock_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_stock_entry_id_stock_entries_id_fk" FOREIGN KEY ("stock_entry_id") REFERENCES "public"."stock_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "losses" ADD CONSTRAINT "losses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "losses" ADD CONSTRAINT "losses_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_document_active_unique" ON "companies" USING btree ("document") WHERE "companies"."deleted_at" is null and "companies"."document" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_company_name_active_unique" ON "categories" USING btree ("company_id",lower("name")) WHERE "categories"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "units_company_name_active_unique" ON "units" USING btree ("company_id",lower("name")) WHERE "units"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "units_company_abbreviation_active_unique" ON "units" USING btree ("company_id",lower("abbreviation")) WHERE "units"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_name_active_unique" ON "products" USING btree ("company_id",lower("name")) WHERE "products"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_sku_active_unique" ON "products" USING btree ("company_id",lower("sku")) WHERE "products"."deleted_at" is null and "products"."sku" is not null;--> statement-breakpoint
CREATE INDEX "products_company_active_idx" ON "products" USING btree ("company_id","active");--> statement-breakpoint
CREATE INDEX "stock_entries_company_entry_date_idx" ON "stock_entries" USING btree ("company_id","entry_date");--> statement-breakpoint
CREATE INDEX "stock_entry_attachments_entry_idx" ON "stock_entry_attachments" USING btree ("stock_entry_id");--> statement-breakpoint
CREATE INDEX "stock_entry_attachments_company_idx" ON "stock_entry_attachments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "stock_entry_items_entry_idx" ON "stock_entry_items" USING btree ("stock_entry_id");--> statement-breakpoint
CREATE INDEX "stock_entry_items_product_idx" ON "stock_entry_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "losses_company_loss_date_idx" ON "losses" USING btree ("company_id","loss_date");--> statement-breakpoint
CREATE INDEX "losses_company_product_idx" ON "losses" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_company_created_at_idx" ON "stock_movements" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_company_product_idx" ON "stock_movements" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE INDEX "system_logs_company_created_at_idx" ON "system_logs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "system_logs_level_created_at_idx" ON "system_logs" USING btree ("level","created_at");--> statement-breakpoint
CREATE INDEX "system_logs_created_at_idx" ON "system_logs" USING btree ("created_at");