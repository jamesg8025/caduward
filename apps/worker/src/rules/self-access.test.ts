import { describe, expect, it } from "vitest";
import { selfAccessRule } from "./self-access.js";
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

describe("selfAccessRule", () => {
  it("fires when staff and patient have matching first and last name", () => {
    const result = selfAccessRule.check(
      ctx({ patient: { firstName: "Alice", lastName: "Smith" } }),
    );
    expect(result.fired).toBe(true);
    expect(result.rule).toBe("self_access");
    expect(result.details).toContain("Alice Smith");
  });

  it("does not fire when only first name matches", () => {
    const result = selfAccessRule.check(
      ctx({ patient: { firstName: "Alice", lastName: "Jones" } }),
    );
    expect(result.fired).toBe(false);
  });

  it("does not fire when only last name matches", () => {
    const result = selfAccessRule.check(ctx({ patient: { firstName: "Bob", lastName: "Smith" } }));
    expect(result.fired).toBe(false);
  });

  it("does not fire when no names match", () => {
    const result = selfAccessRule.check(ctx());
    expect(result.fired).toBe(false);
  });

  it("is case-insensitive", () => {
    const result = selfAccessRule.check(
      ctx({ patient: { firstName: "alice", lastName: "smith" } }),
    );
    expect(result.fired).toBe(true);
  });
});
