CREATE TABLE "company_billings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"reference_month" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2),
	"paid_at" date,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "company_billings" ADD CONSTRAINT "company_billings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_billings" ADD CONSTRAINT "company_billings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_billings" ADD CONSTRAINT "company_billings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_billings_company_reference_unique" ON "company_billings" USING btree ("company_id","reference_month");--> statement-breakpoint
CREATE INDEX "company_billings_reference_due_idx" ON "company_billings" USING btree ("reference_month","due_date");