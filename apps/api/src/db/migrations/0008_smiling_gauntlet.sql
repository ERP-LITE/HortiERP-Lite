ALTER TABLE "companies" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "state_registration" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "street" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address_number" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "complement" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "state" text;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_document_active_unique" ON "companies" USING btree ("document") WHERE "companies"."deleted_at" is null and "companies"."document" is not null;