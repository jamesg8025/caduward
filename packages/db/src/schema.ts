import {
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const accessTypeEnum = pgEnum("access_type", ["view", "edit", "print"]);

export const seededAnomalyTypeEnum = pgEnum("seeded_anomaly_type", [
  "no_encounter",
  "off_shift",
  "relationship_snoop",
  "vip_access",
  "self_access",
  "dormant_reactivation",
]);

export const patients = pgTable("patients", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  address: text("address").notNull(),
  emergencyContact: text("emergency_contact"),
  isVip: boolean("is_vip").notNull().default(false),
});

export const encounters = pgTable(
  "encounters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    department: text("department").notNull(),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
  },
  (table) => [index("encounters_patient_id_idx").on(table.patientId)],
);

export const staff = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  shiftStart: time("shift_start").notNull(),
  shiftEnd: time("shift_end").notNull(),
  address: text("address").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const accessEvents = pgTable(
  "access_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    accessType: accessTypeEnum("access_type").notNull(),
    linkedEncounterId: uuid("linked_encounter_id").references(() => encounters.id, {
      onDelete: "set null",
    }),
    isSeededAnomaly: boolean("is_seeded_anomaly").notNull().default(false),
    seededAnomalyType: seededAnomalyTypeEnum("seeded_anomaly_type"),
  },
  (table) => [
    index("access_events_staff_id_idx").on(table.staffId),
    index("access_events_patient_id_idx").on(table.patientId),
    index("access_events_timestamp_idx").on(table.timestamp),
  ],
);
