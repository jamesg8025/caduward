import * as schema from "@caduward/db";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { refreshRoleBaselines } from "./baselines/refresh.js";
import { runDetectionPass } from "./detect.js";

const TEST_DB_URL =
  process.env.CADUWARD_DATABASE_URL ?? "postgresql://caduward:caduward@localhost:5433/caduward";

const client = postgres(TEST_DB_URL);
const db = drizzle(client, { schema });

// --- Test fixtures ---

const PATIENTS = [
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
  {
    id: "33333333-3333-4333-8333-333333333333",
    firstName: "Emma",
    lastName: "Chen",
    dateOfBirth: "1990-01-01",
    address: "789 Elm St",
    emergencyContact: null,
    isVip: false,
  },
];

const ENCOUNTERS = [
  {
    id: "aaaa1111-1111-4111-8111-111111111111",
    patientId: "22222222-2222-4222-8222-222222222222",
    provider: "Dr. Chen",
    department: "General Medicine",
    scheduledStart: new Date("2025-01-10T09:00:00Z"),
    scheduledEnd: new Date("2025-01-10T10:00:00Z"),
  },
];

const STAFF = [
  {
    id: "bbbb1111-1111-4111-8111-111111111111",
    firstName: "Emma",
    lastName: "Chen",
    role: "nurse",
    department: "General Medicine",
    shiftStart: "08:00",
    shiftEnd: "16:00",
    address: "789 Elm St",
    isActive: true,
  },
  {
    id: "bbbb2222-2222-4222-8222-222222222222",
    firstName: "Dan",
    lastName: "Smith",
    role: "physician",
    department: "Cardiology",
    shiftStart: "09:00",
    shiftEnd: "17:00",
    address: "321 Pine Rd",
    isActive: false,
  },
];

beforeAll(async () => {
  await db.execute(sql`SELECT 1 FROM patients LIMIT 0`);
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE anomaly_flags, role_baselines, access_events, encounters, staff, patients CASCADE`,
  );
  await db.insert(schema.patients).values(PATIENTS);
  await db.insert(schema.encounters).values(ENCOUNTERS);
  await db.insert(schema.staff).values(STAFF);
});

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE anomaly_flags, role_baselines, access_events, encounters, staff, patients CASCADE`,
  );
});

afterAll(async () => {
  await client.end();
});

describe("runDetectionPass", () => {
  it("flags a no-encounter event", async () => {
    await db.insert(schema.accessEvents).values({
      id: "cccc1111-1111-4111-8111-111111111111",
      staffId: "bbbb1111-1111-4111-8111-111111111111",
      patientId: "22222222-2222-4222-8222-222222222222",
      timestamp: new Date("2025-01-10T10:00:00Z"),
      accessType: "view",
      linkedEncounterId: null,
    });

    const result = await runDetectionPass(db);
    expect(result.totalFlagged).toBe(1);

    const flags = await db.select().from(schema.anomalyFlags);
    expect(flags).toHaveLength(1);
    expect(flags[0].triggeredRules).toContain("no_encounter");
  });

  it("flags an off-shift event", async () => {
    await db.insert(schema.accessEvents).values({
      id: "cccc2222-2222-4222-8222-222222222222",
      staffId: "bbbb1111-1111-4111-8111-111111111111",
      patientId: "22222222-2222-4222-8222-222222222222",
      timestamp: new Date("2025-01-10T03:00:00Z"), // 03:00, shift is 08:00-16:00
      accessType: "view",
      linkedEncounterId: "aaaa1111-1111-4111-8111-111111111111",
    });

    const result = await runDetectionPass(db);
    expect(result.totalFlagged).toBe(1);

    const flags = await db.select().from(schema.anomalyFlags);
    expect(flags[0].triggeredRules).toContain("off_shift");
  });

  it("flags a relationship-snoop event", async () => {
    // Staff Dan Smith accesses patient Alice Smith (shared last name)
    await db.insert(schema.accessEvents).values({
      id: "cccc3333-3333-4333-8333-333333333333",
      staffId: "bbbb2222-2222-4222-8222-222222222222",
      patientId: "11111111-1111-4111-8111-111111111111",
      timestamp: new Date("2025-01-10T10:00:00Z"),
      accessType: "view",
      linkedEncounterId: null,
    });

    const result = await runDetectionPass(db);
    expect(result.totalFlagged).toBe(1);

    const flags = await db.select().from(schema.anomalyFlags);
    expect(flags[0].triggeredRules).toContain("relationship_snoop");
  });

  it("flags VIP access without encounter", async () => {
    // Nurse accesses VIP patient Alice Smith but has no encounter in General Medicine for her
    await db.insert(schema.accessEvents).values({
      id: "cccc4444-4444-4444-8444-444444444444",
      staffId: "bbbb1111-1111-4111-8111-111111111111",
      patientId: "11111111-1111-4111-8111-111111111111",
      timestamp: new Date("2025-01-10T10:00:00Z"),
      accessType: "view",
      linkedEncounterId: null,
    });

    const result = await runDetectionPass(db);
    expect(result.totalFlagged).toBe(1);

    const flags = await db.select().from(schema.anomalyFlags);
    expect(flags[0].triggeredRules).toContain("vip_access");
  });

  it("flags self-access", async () => {
    // Staff Emma Chen accesses patient Emma Chen (same name)
    await db.insert(schema.accessEvents).values({
      id: "cccc5555-5555-4555-8555-555555555555",
      staffId: "bbbb1111-1111-4111-8111-111111111111",
      patientId: "33333333-3333-4333-8333-333333333333",
      timestamp: new Date("2025-01-10T10:00:00Z"),
      accessType: "view",
      linkedEncounterId: null,
    });

    const result = await runDetectionPass(db);
    expect(result.totalFlagged).toBe(1);

    const flags = await db.select().from(schema.anomalyFlags);
    expect(flags[0].triggeredRules).toContain("self_access");
  });

  it("does not flag normal access", async () => {
    // Nurse accesses non-VIP patient Carol Jones within shift, with linked encounter, no name overlap
    await db.insert(schema.accessEvents).values({
      id: "cccc6666-6666-4666-8666-666666666666",
      staffId: "bbbb1111-1111-4111-8111-111111111111",
      patientId: "22222222-2222-4222-8222-222222222222",
      timestamp: new Date("2025-01-10T10:00:00Z"),
      accessType: "view",
      linkedEncounterId: "aaaa1111-1111-4111-8111-111111111111",
    });

    const result = await runDetectionPass(db);
    expect(result.totalFlagged).toBe(0);

    const flags = await db.select().from(schema.anomalyFlags);
    expect(flags).toHaveLength(0);
  });

  it("assigns correct severity for multi-rule events", async () => {
    // Dan Smith (inactive) accesses Alice Smith (VIP, shared last name) -> dormant + relationship + vip + no_encounter
    await db.insert(schema.accessEvents).values({
      id: "cccc7777-7777-4777-8777-777777777777",
      staffId: "bbbb2222-2222-4222-8222-222222222222",
      patientId: "11111111-1111-4111-8111-111111111111",
      timestamp: new Date("2025-01-10T10:00:00Z"),
      accessType: "view",
      linkedEncounterId: null,
    });

    const result = await runDetectionPass(db);
    expect(result.totalFlagged).toBe(1);

    const flags = await db.select().from(schema.anomalyFlags);
    expect(flags[0].severity).toBe("critical"); // 3+ rules
    expect(flags[0].triggeredRules.length).toBeGreaterThanOrEqual(3);
  });

  it("is idempotent on re-run", async () => {
    await db.insert(schema.accessEvents).values({
      id: "cccc8888-8888-4888-8888-888888888888",
      staffId: "bbbb1111-1111-4111-8111-111111111111",
      patientId: "22222222-2222-4222-8222-222222222222",
      timestamp: new Date("2025-01-10T10:00:00Z"),
      accessType: "view",
      linkedEncounterId: null,
    });

    await runDetectionPass(db);
    const firstRun = await db.select().from(schema.anomalyFlags);

    await runDetectionPass(db);
    const secondRun = await db.select().from(schema.anomalyFlags);

    expect(secondRun).toHaveLength(firstRun.length);
  });
});

describe("refreshRoleBaselines", () => {
  it("computes baselines from unflagged events", async () => {
    await db.insert(schema.accessEvents).values({
      id: "cccc9999-9999-4999-8999-999999999999",
      staffId: "bbbb1111-1111-4111-8111-111111111111",
      patientId: "22222222-2222-4222-8222-222222222222",
      timestamp: new Date("2025-01-10T10:00:00Z"),
      accessType: "view",
      linkedEncounterId: "aaaa1111-1111-4111-8111-111111111111",
    });

    const result = await refreshRoleBaselines(db);
    expect(result.rolesUpdated).toBeGreaterThan(0);

    const baselines = await db.select().from(schema.roleBaselines);
    expect(baselines.length).toBeGreaterThan(0);

    const nurseBaseline = baselines.find(
      (b) => b.role === "nurse" && b.department === "General Medicine",
    );
    expect(nurseBaseline).toBeDefined();
    expect(nurseBaseline?.centroid).toHaveLength(9);
    expect(nurseBaseline?.eventCount).toBe(1);
  });
});
