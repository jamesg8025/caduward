import { describe, expect, it } from "vitest";
import type { AccessEventRow, PatientRow, RuleContext, StaffRow } from "./types.js";
import { vipAccessRule } from "./vip-access.js";

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

describe("vipAccessRule", () => {
  it("fires when VIP patient is accessed with no encounter and no linked encounter", () => {
    const result = vipAccessRule.check(
      ctx({
        event: { linkedEncounterId: null },
        patient: { isVip: true },
        hasEncounterForStaffAndPatient: false,
      }),
    );
    expect(result.fired).toBe(true);
    expect(result.rule).toBe("vip_access");
    expect(result.details).toContain("VIP");
  });

  it("does not fire when VIP patient has a department-level encounter", () => {
    const result = vipAccessRule.check(
      ctx({
        event: { linkedEncounterId: null },
        patient: { isVip: true },
        hasEncounterForStaffAndPatient: true,
      }),
    );
    expect(result.fired).toBe(false);
  });

  it("does not fire when event has a directly linked encounter, even without department encounter", () => {
    const result = vipAccessRule.check(
      ctx({
        event: { linkedEncounterId: "enc-1" },
        patient: { isVip: true },
        hasEncounterForStaffAndPatient: false,
      }),
    );
    expect(result.fired).toBe(false);
  });

  it("does not fire for non-VIP patients", () => {
    const result = vipAccessRule.check(
      ctx({ event: { linkedEncounterId: null }, hasEncounterForStaffAndPatient: false }),
    );
    expect(result.fired).toBe(false);
  });
});
