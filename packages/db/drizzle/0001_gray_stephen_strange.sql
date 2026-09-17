CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('open', 'reviewed', 'escalated', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anomaly_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_event_id" uuid NOT NULL,
	"triggered_rules" text[] NOT NULL,
	"severity" "severity" NOT NULL,
	"similarity_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_status" "review_status" DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"department" text NOT NULL,
	"centroid" vector(9) NOT NULL,
	"event_count" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_access_event_id_access_events_id_fk" FOREIGN KEY ("access_event_id") REFERENCES "public"."access_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "anomaly_flags_access_event_id_idx" ON "anomaly_flags" USING btree ("access_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anomaly_flags_severity_idx" ON "anomaly_flags" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anomaly_flags_review_status_idx" ON "anomaly_flags" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anomaly_flags_created_at_idx" ON "anomaly_flags" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_baselines_role_department_idx" ON "role_baselines" USING btree ("role","department");