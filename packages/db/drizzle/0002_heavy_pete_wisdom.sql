CREATE TABLE IF NOT EXISTS "flag_explanations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flag_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"contributing_factors" text[] NOT NULL,
	"recommended_action" text NOT NULL,
	"raw_model_response" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flag_explanations" ADD CONSTRAINT "flag_explanations_flag_id_anomaly_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."anomaly_flags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "flag_explanations_flag_id_idx" ON "flag_explanations" USING btree ("flag_id");