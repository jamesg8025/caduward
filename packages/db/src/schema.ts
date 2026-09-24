import {
  boolean,
  customType,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const VECTOR_DIMENSIONS = 9;

const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return `vector(${VECTOR_DIMENSIONS})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    return String(value).replace(/[[\]]/g, "").split(",").map(Number);
  },
});

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

// --- Phase 2: Detection engine tables ---

export const reviewStatusEnum = pgEnum("review_status", [
  "open",
  "reviewed",
  "escalated",
  "dismissed",
]);

export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);

export const anomalyFlags = pgTable(
  "anomaly_flags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accessEventId: uuid("access_event_id")
      .notNull()
      .references(() => accessEvents.id, { onDelete: "cascade" }),
    triggeredRules: text("triggered_rules").array().notNull(),
    severity: severityEnum("severity").notNull(),
    similarityScore: real("similarity_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewStatus: reviewStatusEnum("review_status").notNull().default("open"),
  },
  (table) => [
    uniqueIndex("anomaly_flags_access_event_id_idx").on(table.accessEventId),
    index("anomaly_flags_severity_idx").on(table.severity),
    index("anomaly_flags_review_status_idx").on(table.reviewStatus),
    index("anomaly_flags_created_at_idx").on(table.createdAt),
  ],
);

export const flagExplanations = pgTable(
  "flag_explanations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    flagId: uuid("flag_id")
      .notNull()
      .references(() => anomalyFlags.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    contributingFactors: text("contributing_factors").array().notNull(),
    recommendedAction: text("recommended_action").notNull(),
    rawModelResponse: text("raw_model_response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("flag_explanations_flag_id_idx").on(table.flagId)],
);

// --- Phase 4: Auth tables (better-auth) ---

export const userRoleEnum = pgEnum("user_role", ["admin", "reviewer"]);

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  role: text("role").default("reviewer"),
  banned: boolean("banned"),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires"),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const roleBaselines = pgTable(
  "role_baselines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    role: text("role").notNull(),
    department: text("department").notNull(),
    centroid: vector("centroid").notNull(),
    eventCount: integer("event_count").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("role_baselines_role_department_idx").on(table.role, table.department)],
);
