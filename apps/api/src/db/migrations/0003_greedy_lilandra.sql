ALTER TABLE "losses" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "losses" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "losses" ADD COLUMN "cancel_reason" text;