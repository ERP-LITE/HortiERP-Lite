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
ALTER TABLE "stock_entries" ADD COLUMN "invoice_number" text;--> statement-breakpoint
ALTER TABLE "stock_entries" ADD COLUMN "invoice_series" text;--> statement-breakpoint
ALTER TABLE "stock_entries" ADD COLUMN "invoice_access_key" text;--> statement-breakpoint
ALTER TABLE "stock_entries" ADD COLUMN "invoice_issued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_entries" ADD COLUMN "invoice_total" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "stock_entry_attachments" ADD CONSTRAINT "stock_entry_attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entry_attachments" ADD CONSTRAINT "stock_entry_attachments_stock_entry_id_stock_entries_id_fk" FOREIGN KEY ("stock_entry_id") REFERENCES "public"."stock_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_entry_attachments_entry_idx" ON "stock_entry_attachments" USING btree ("stock_entry_id");--> statement-breakpoint
CREATE INDEX "stock_entry_attachments_company_idx" ON "stock_entry_attachments" USING btree ("company_id");