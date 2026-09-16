CREATE TYPE "public"."access_type" AS ENUM('view', 'edit', 'print');--> statement-breakpoint
CREATE TYPE "public"."seeded_anomaly_type" AS ENUM('no_encounter', 'off_shift', 'relationship_snoop', 'vip_access', 'self_access', 'dormant_reactivation');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"access_type" "access_type" NOT NULL,
	"linked_encounter_id" uuid,
	"is_seeded_anomaly" boolean DEFAULT false NOT NULL,
	"seeded_anomaly_type" "seeded_anomaly_type"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "encounters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"department" text NOT NULL,
	"scheduled_start" timestamp with time zone NOT NULL,
	"scheduled_end" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"address" text NOT NULL,
	"emergency_contact" text,
	"is_vip" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" text NOT NULL,
	"department" text NOT NULL,
	"shift_start" time NOT NULL,
	"shift_end" time NOT NULL,
	"address" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_events" ADD CONSTRAINT "access_events_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_events" ADD CONSTRAINT "access_events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_events" ADD CONSTRAINT "access_events_linked_encounter_id_encounters_id_fk" FOREIGN KEY ("linked_encounter_id") REFERENCES "public"."encounters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_events_staff_id_idx" ON "access_events" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_events_patient_id_idx" ON "access_events" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_events_timestamp_idx" ON "access_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "encounters_patient_id_idx" ON "encounters" USING btree ("patient_id");