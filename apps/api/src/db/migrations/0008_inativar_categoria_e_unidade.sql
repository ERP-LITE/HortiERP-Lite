ALTER TABLE "categories" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "active" boolean DEFAULT true NOT NULL;