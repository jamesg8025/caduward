import * as schema from "@caduward/db";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TransformedEncounter, TransformedPatient } from "./fhir/transform.js";
import type { GeneratedAccessEvent } from "./generators/access-events.js";
import type { GeneratedStaff } from "./generators/staff.js";
import { seedDatabase } from "./seed.js";

const TEST_DB_URL =
  process.env.CADUWARD_DATABASE_URL ?? "postgresql://caduward:caduward@localhost:5433/caduward";

const client = postgres(TEST_DB_URL);
const db = drizzle(client, { schema });

const PATIENTS: TransformedPatient[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    firstName: "Alice",
    lastName: "Smith",
    dateOfBirth: "1985-03-15",
    address: "123 Main St",
    emergencyContact: "Bob Smith",
    isVip: true,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    firstName: "Carol",
    lastName: "Jones",
    dateOfBirth: "1970-07-22",
    address: "456 Oak Ave",
    emergencyContact: null,
    isVip: false,
  },
];

const ENCOUNTERS: TransformedEncounter[] = [
  {
    id: "aaaa1111-1111-4111-8111-111111111111",
    patientId: "11111111-1111-4111-8111-111111111111",
    provider: "Dr. Chen",
    department: "General Medicine",
    scheduledStart: new Date("2025-01-10T09:00:00Z"),
    scheduledEnd: new Date("2025-01-10T10:00:00Z"),
  },
];

const STAFF: GeneratedStaff[] = [
  {
    id: "bbbb1111-1111-4111-8111-111111111111",
    firstName: "Emma",
    lastName: "Chen",
    role: "nurse",
    department: "General Medicine",
    shiftStart: "06:00",
    shiftEnd: "14:00",
    address: "789 Elm St",
    isActive: true,
    patientId: null,
  },
];

const ACCESS_EVENTS: GeneratedAccessEvent[] = [
  {
    id: "cccc1111-1111-4111-8111-111111111111",
    staffId: "bbbb1111-1111-4111-8111-111111111111",
    patientId: "11111111-1111-4111-8111-111111111111",
    timestamp: new Date("2025-01-10T09:30:00Z"),
    accessType: "view",
    linkedEncounterId: "aaaa1111-1111-4111-8111-111111111111",
    isSeededAnomaly: false,
    seededAnomalyType: null,
  },
  {
    id: "cccc2222-2222-4222-8222-222222222222",
    staffId: "bbbb1111-1111-4111-8111-111111111111",
    patientId: "22222222-2222-4222-8222-222222222222",
    timestamp: new Date("2025-01-11T03:00:00Z"),
    accessType: "view",
    linkedEncounterId: null,
    isSeededAnomaly: true,
    seededAnomalyType: "off_shift",
  },
];

beforeAll(async () => {
  // Ensure tables exist (migration should have run)
  await db.execute(sql`SELECT 1 FROM patients LIMIT 0`);
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE access_events, encounters, staff, patients CASCADE`);
});

afterAll(async () => {
  await client.end();
});

describe("seedDatabase", () => {
  it("inserts all records into the database", async () => {
    await seedDatabase(
      { patients: PATIENTS, encounters: ENCOUNTERS, staff: STAFF, accessEvents: ACCESS_EVENTS },
      db,
    );

    const patientRows = await db.select().from(schema.patients);
    expect(patientRows).toHaveLength(2);

    const encounterRows = await db.select().from(schema.encounters);
    expect(encounterRows).toHaveLength(1);

    const staffRows = await db.select().from(schema.staff);
    expect(staffRows).toHaveLength(1);

    const eventRows = await db.select().from(schema.accessEvents);
    expect(eventRows).toHaveLength(2);
  });

  it("preserves anomaly metadata on access events", async () => {
    await seedDatabase(
      { patients: PATIENTS, encounters: ENCOUNTERS, staff: STAFF, accessEvents: ACCESS_EVENTS },
      db,
    );

    const events = await db.select().from(schema.accessEvents);
    const normalEvent = events.find((e) => e.id === "cccc1111-1111-4111-8111-111111111111");
    const anomalyEvent = events.find((e) => e.id === "cccc2222-2222-4222-8222-222222222222");

    expect(normalEvent?.isSeededAnomaly).toBe(false);
    expect(normalEvent?.seededAnomalyType).toBeNull();
    expect(anomalyEvent?.isSeededAnomaly).toBe(true);
    expect(anomalyEvent?.seededAnomalyType).toBe("off_shift");
  });

  it("preserves VIP flag on patients", async () => {
    await seedDatabase(
      { patients: PATIENTS, encounters: ENCOUNTERS, staff: STAFF, accessEvents: ACCESS_EVENTS },
      db,
    );

    const rows = await db.select().from(schema.patients);
    const alice = rows.find((r) => r.firstName === "Alice");
    const carol = rows.find((r) => r.firstName === "Carol");

    expect(alice?.isVip).toBe(true);
    expect(carol?.isVip).toBe(false);
  });

  it("is idempotent — truncates before inserting", async () => {
    const data = {
      patients: PATIENTS,
      encounters: ENCOUNTERS,
      staff: STAFF,
      accessEvents: ACCESS_EVENTS,
    };

    await seedDatabase(data, db);
    await seedDatabase(data, db);

    const patientRows = await db.select().from(schema.patients);
    expect(patientRows).toHaveLength(2);
  });
});
