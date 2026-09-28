import { describe, expect, it } from "vitest";
import { relationshipSnoopRule } from "./relationship-snoop.js";
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

describe("relationshipSnoopRule", () => {
  it("fires when staff and patient share a last name and have no encounter", () => {
    const result = relationshipSnoopRule.check(
      ctx({ patient: { lastName: "Smith" }, hasEncounterForStaffAndPatient: false }),
    );
    expect(result.fired).toBe(true);
    expect(result.details).toContain("shared last name");
  });

  it("fires when staff and patient share an address and have no encounter", () => {
    const result = relationshipSnoopRule.check(
      ctx({ patient: { address: "123 Main St" }, hasEncounterForStaffAndPatient: false }),
    );
    expect(result.fired).toBe(true);
    expect(result.details).toContain("shared address");
  });

  it("fires when emergency contact contains staff last name and have no encounter", () => {
    const result = relationshipSnoopRule.check(
      ctx({
        patient: { emergencyContact: "Jane Smith (555-1234)" },
        hasEncounterForStaffAndPatient: false,
      }),
    );
    expect(result.fired).toBe(true);
    expect(result.details).toContain("emergency contact");
  });

  it("reports all matching attributes when multiple match", () => {
    const result = relationshipSnoopRule.check(
      ctx({
        patient: {
          lastName: "Smith",
          address: "123 Main St",
          emergencyContact: "Contact: Smith",
        },
        hasEncounterForStaffAndPatient: false,
      }),
    );
    expect(result.fired).toBe(true);
    expect(result.details).toContain("shared last name");
    expect(result.details).toContain("shared address");
    expect(result.details).toContain("emergency contact");
  });

  it("does not fire when attributes match but an encounter exists", () => {
    const result = relationshipSnoopRule.check(
      ctx({ patient: { lastName: "Smith" }, hasEncounterForStaffAndPatient: true }),
    );
    expect(result.fired).toBe(false);
  });

  it("does not fire when no attributes match", () => {
    const result = relationshipSnoopRule.check(ctx({ hasEncounterForStaffAndPatient: false }));
    expect(result.fired).toBe(false);
  });

  it("is case-insensitive for last name matching", () => {
    const result = relationshipSnoopRule.check(
      ctx({ patient: { lastName: "smith" }, hasEncounterForStaffAndPatient: false }),
    );
    expect(result.fired).toBe(true);
  });
});
