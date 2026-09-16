import { describe, expect, it } from "vitest";
import { offShiftRule } from "./off-shift.js";
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

describe("offShiftRule", () => {
  it("fires when access is outside shift hours", () => {
    const result = offShiftRule.check(
      ctx({ event: { timestamp: new Date("2025-01-15T03:00:00Z") } }),
    );
    expect(result.fired).toBe(true);
    expect(result.rule).toBe("off_shift");
    expect(result.details).toContain("3:00");
  });

  it("does not fire when access is within shift hours", () => {
    const result = offShiftRule.check(
      ctx({ event: { timestamp: new Date("2025-01-15T12:00:00Z") } }),
    );
    expect(result.fired).toBe(false);
  });

  it("handles overnight shifts correctly (22:00-06:00)", () => {
    const nightStaff = { shiftStart: "22:00", shiftEnd: "06:00" };

    // 23:00 is within shift
    const withinResult = offShiftRule.check(
      ctx({
        event: { timestamp: new Date("2025-01-15T23:00:00Z") },
        staff: nightStaff,
      }),
    );
    expect(withinResult.fired).toBe(false);

    // 03:00 is within shift
    const earlyMorning = offShiftRule.check(
      ctx({
        event: { timestamp: new Date("2025-01-15T03:00:00Z") },
        staff: nightStaff,
      }),
    );
    expect(earlyMorning.fired).toBe(false);

    // 14:00 is outside shift
    const outsideResult = offShiftRule.check(
      ctx({
        event: { timestamp: new Date("2025-01-15T14:00:00Z") },
        staff: nightStaff,
      }),
    );
    expect(outsideResult.fired).toBe(true);
  });

  it("does not fire at exact shift start hour", () => {
    const result = offShiftRule.check(
      ctx({ event: { timestamp: new Date("2025-01-15T08:30:00Z") } }),
    );
    expect(result.fired).toBe(false);
  });

  it("fires at exact shift end hour", () => {
    const result = offShiftRule.check(
      ctx({ event: { timestamp: new Date("2025-01-15T16:00:00Z") } }),
    );
    expect(result.fired).toBe(true);
  });
});
