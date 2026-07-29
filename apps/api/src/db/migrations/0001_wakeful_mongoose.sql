ALTER TYPE "public"."user_role" ADD VALUE 'super_admin';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "active" boolean DEFAULT true NOT NULL;