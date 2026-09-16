import { accessEvents, encounters, patients, staff } from "@caduward/db";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { TransformedEncounter, TransformedPatient } from "./fhir/transform.js";
import type { GeneratedAccessEvent } from "./generators/access-events.js";
import type { GeneratedStaff } from "./generators/staff.js";

const BATCH_SIZE = 1000;

export interface SeedData {
  patients: TransformedPatient[];
  encounters: TransformedEncounter[];
  staff: GeneratedStaff[];
  accessEvents: GeneratedAccessEvent[];
}

async function batchInsert<T extends Record<string, unknown>>(
  db: PostgresJsDatabase,
  table: Parameters<PostgresJsDatabase["insert"]>[0],
  rows: T[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(table).values(batch);
  }
}

export async function seedDatabase(data: SeedData, db: PostgresJsDatabase): Promise<void> {
  // Truncate in reverse FK order
  await db.execute(sql`TRUNCATE TABLE access_events, encounters, staff, patients CASCADE`);

  // Insert in FK order
  await batchInsert(
    db,
    patients,
    data.patients.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth,
      address: p.address,
      emergencyContact: p.emergencyContact,
      isVip: p.isVip,
    })),
  );

  await batchInsert(
    db,
    encounters,
    data.encounters.map((e) => ({
      id: e.id,
      patientId: e.patientId,
      provider: e.provider,
      department: e.department,
      scheduledStart: e.scheduledStart,
      scheduledEnd: e.scheduledEnd,
    })),
  );

  await batchInsert(
    db,
    staff,
    data.staff.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role,
      department: s.department,
      shiftStart: s.shiftStart,
      shiftEnd: s.shiftEnd,
      address: s.address,
      isActive: s.isActive,
    })),
  );

  await batchInsert(
    db,
    accessEvents,
    data.accessEvents.map((e) => ({
      id: e.id,
      staffId: e.staffId,
      patientId: e.patientId,
      timestamp: e.timestamp,
      accessType: e.accessType,
      linkedEncounterId: e.linkedEncounterId,
      isSeededAnomaly: e.isSeededAnomaly,
      seededAnomalyType: e.seededAnomalyType,
    })),
  );
}
