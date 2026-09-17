import type { AnomalyType } from "@caduward/shared";

/** Access event fields visible to the detection engine.
 *  Deliberately excludes isSeededAnomaly and seededAnomalyType (ground-truth firewall). */
export interface AccessEventRow {
  id: string;
  staffId: string;
  patientId: string;
  timestamp: Date;
  accessType: string;
  linkedEncounterId: string | null;
}

export interface StaffRow {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  shiftStart: string; // HH:MM:SS or HH:MM
  shiftEnd: string;
  address: string;
  isActive: boolean;
}

export interface PatientRow {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  emergencyContact: string | null;
  isVip: boolean;
}

export interface RuleContext {
  event: AccessEventRow;
  staff: StaffRow;
  patient: PatientRow;
  /** Whether any encounter exists for this patient in the staff member's department. */
  hasEncounterForStaffAndPatient: boolean;
}

export interface RuleResult {
  rule: AnomalyType;
  fired: boolean;
  details?: string;
}

export interface DetectionRule {
  name: AnomalyType;
  check: (ctx: RuleContext) => RuleResult;
}
