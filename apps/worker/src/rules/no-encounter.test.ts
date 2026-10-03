import { describe, expect, it } from "vitest";
import { noEncounterRule } from "./no-encounter.js";
import type { AccessEventRow, PatientRow, RuleContext, StaffRow } from "./types.js";

const baseEvent: AccessEventRow = {
  id: "evt-1",
  staffId: "staff-1",
  patientId: "patient-1",
  timestamp: new Date("2025-01-15T10:00:00Z"),
  accessType: "view",
  linkedEncounterId: "enc-1",
};

const baseStaff: StaffRow = {
  id: "staff-1",
  firstName: "Alice",
  lastName: "Smith",
  role: "nurse",
  department: "Emergency",
  shiftStart: "08:00",
  shiftEnd: "16:00",
  address: "123 Main St",
  isActive: true,
  patientId: null,
};

const basePatient: PatientRow = {
  id: "patient-1",
  firstName: "Bob",
  lastName: "Jones",
  address: "456 Oak Ave",
  emergencyContact: null,
  isVip: false,
};

function ctx(overrides?: {
  event?: Partial<AccessEventRow>;
  staff?: Partial<StaffRow>;
  patient?: Partial<PatientRow>;
  hasEncounterForStaffAndPatient?: boolean;
}): RuleContext {
  return {
    event: { ...baseEvent, ...overrides?.event },
    staff: { ...baseStaff, ...overrides?.staff },
    patient: { ...basePatient, ...overrides?.patient },
    hasEncounterForStaffAndPatient: overrides?.hasEncounterForStaffAndPatient ?? true,
  };
}

describe("noEncounterRule", () => {
  it("fires when there is no linked encounter", () => {
    const result = noEncounterRule.check(ctx({ event: { linkedEncounterId: null } }));
    expect(result.fired).toBe(true);
    expect(result.rule).toBe("no_encounter");
    expect(result.details).toBeDefined();
  });

  it("does not fire when an encounter is linked", () => {
    const result = noEncounterRule.check(ctx());
    expect(result.fired).toBe(false);
  });
});
