import {
  accessEvents,
  anomalyFlags,
  encounters,
  patients,
  roleBaselines,
  staff,
} from "@caduward/db";
import type { Database } from "@caduward/db";
import { eq, isNull, sql } from "drizzle-orm";
import { computeCentroid } from "./compute.js";
import { computeFeatureVector } from "./features.js";

/**
 * Recompute role baseline centroids from access events that have not been flagged.
 * Upserts into role_baselines, one row per (role, department).
 */
export async function refreshRoleBaselines(database: Database): Promise<{ rolesUpdated: number }> {
  // Fetch unflagged access events with their staff, patient, and encounter data.
  // We exclude ground-truth fields from the select.
  const rows = await database
    .select({
      eventId: accessEvents.id,
      staffId: accessEvents.staffId,
      patientId: accessEvents.patientId,
      timestamp: accessEvents.timestamp,
      accessType: accessEvents.accessType,
      linkedEncounterId: accessEvents.linkedEncounterId,
      staffRole: staff.role,
      staffDepartment: staff.department,
      staffShiftStart: staff.shiftStart,
      staffShiftEnd: staff.shiftEnd,
      staffAddress: staff.address,
      staffFirstName: staff.firstName,
      staffLastName: staff.lastName,
      staffIsActive: staff.isActive,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientAddress: patients.address,
      patientEmergencyContact: patients.emergencyContact,
      patientIsVip: patients.isVip,
      encounterDepartment: encounters.department,
    })
    .from(accessEvents)
    .innerJoin(staff, eq(accessEvents.staffId, staff.id))
    .innerJoin(patients, eq(accessEvents.patientId, patients.id))
    .leftJoin(encounters, eq(accessEvents.linkedEncounterId, encounters.id))
    .leftJoin(anomalyFlags, eq(accessEvents.id, anomalyFlags.accessEventId))
    .where(isNull(anomalyFlags.id));

  // Group by role+department and compute feature vectors
  const groups = new Map<string, number[][]>();

  for (const row of rows) {
    const key = `${row.staffRole}::${row.staffDepartment}`;
    const vector = computeFeatureVector(
      {
        id: row.eventId,
        staffId: row.staffId,
        patientId: row.patientId,
        timestamp: row.timestamp,
        accessType: row.accessType,
        linkedEncounterId: row.linkedEncounterId,
      },
      {
        id: row.staffId,
        firstName: row.staffFirstName,
        lastName: row.staffLastName,
        role: row.staffRole,
        department: row.staffDepartment,
        shiftStart: row.staffShiftStart,
        shiftEnd: row.staffShiftEnd,
        address: row.staffAddress,
        isActive: row.staffIsActive,
      },
      {
        id: row.patientId,
        firstName: row.patientFirstName,
        lastName: row.patientLastName,
        address: row.patientAddress,
        emergencyContact: row.patientEmergencyContact,
        isVip: row.patientIsVip,
      },
      row.encounterDepartment ?? undefined,
    );

    const existing = groups.get(key) ?? [];
    existing.push(vector);
    groups.set(key, existing);
  }

  // Upsert centroids
  let rolesUpdated = 0;

  for (const [key, vectors] of groups) {
    const [role, department] = key.split("::");
    const centroid = computeCentroid(vectors);

    await database
      .insert(roleBaselines)
      .values({
        role,
        department,
        centroid,
        eventCount: vectors.length,
      })
      .onConflictDoUpdate({
        target: [roleBaselines.role, roleBaselines.department],
        set: {
          centroid,
          eventCount: vectors.length,
          computedAt: sql`now()`,
        },
      });

    rolesUpdated++;
  }

  return { rolesUpdated };
}
