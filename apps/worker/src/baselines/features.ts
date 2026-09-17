import { VECTOR_DIMENSIONS } from "@caduward/db";
import type { AccessEventRow, PatientRow, StaffRow } from "../rules/types.js";

/**
 * Computes a numeric feature vector for an access event.
 *
 * Dimensions (9 total, must match VECTOR_DIMENSIONS in schema):
 *  0: hour of day (normalized 0-1)
 *  1: day of week (normalized 0-1)
 *  2-4: access type one-hot [view, edit, print]
 *  5: has linked encounter (binary)
 *  6: is VIP patient (binary)
 *  7: staff active (binary)
 *  8: same department as encounter (binary)
 */
export function computeFeatureVector(
  event: AccessEventRow,
  staff: StaffRow,
  patient: PatientRow,
  encounterDepartment?: string,
): number[] {
  const vector = new Array<number>(VECTOR_DIMENSIONS).fill(0);

  // 0: hour of day normalized
  vector[0] = event.timestamp.getUTCHours() / 24;

  // 1: day of week normalized
  vector[1] = event.timestamp.getUTCDay() / 7;

  // 2-4: access type one-hot
  vector[2] = event.accessType === "view" ? 1 : 0;
  vector[3] = event.accessType === "edit" ? 1 : 0;
  vector[4] = event.accessType === "print" ? 1 : 0;

  // 5: has linked encounter
  vector[5] = event.linkedEncounterId !== null ? 1 : 0;

  // 6: is VIP patient
  vector[6] = patient.isVip ? 1 : 0;

  // 7: staff active
  vector[7] = staff.isActive ? 1 : 0;

  // 8: same department as encounter
  vector[8] = encounterDepartment !== undefined && encounterDepartment === staff.department ? 1 : 0;

  return vector;
}
