import { describe, expect, it } from "vitest";
import { type PatternDeviationContext, checkPatternDeviation } from "./pattern-deviation.js";
import type { AccessEventRow, PatientRow, StaffRow } from "./types.js";

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

function makeCtx(overrides: Partial<PatternDeviationContext>): PatternDeviationContext {
  return {
    event: baseEvent,
    staff: baseStaff,
    patient: basePatient,
    hasEncounterForStaffAndPatient: true,
    featureVector: [0.5, 0.4, 1, 0, 0, 1, 0, 1, 1],
    baselineCentroid: [0.5, 0.4, 1, 0, 0, 1, 0, 1, 1],
    similarityThreshold: 0.7,
    ...overrides,
  };
}

describe("checkPatternDeviation", () => {
  it("does not fire when similarity is above threshold", () => {
    const result = checkPatternDeviation(makeCtx({}));
    expect(result.fired).toBe(false);
    expect(result.similarityScore).toBeCloseTo(1);
  });

  it("fires when similarity is below threshold", () => {
    const result = checkPatternDeviation(
      makeCtx({
        featureVector: [0.1, 0.9, 0, 0, 1, 0, 1, 0, 0],
        baselineCentroid: [0.9, 0.1, 1, 0, 0, 1, 0, 1, 1],
        similarityThreshold: 0.9,
      }),
    );
    expect(result.fired).toBe(true);
    expect(result.rule).toBe("pattern_deviation");
    expect(result.details).toContain("below threshold");
    expect(result.similarityScore).toBeDefined();
  });

  it("does not fire when no baseline exists", () => {
    const result = checkPatternDeviation(makeCtx({ baselineCentroid: null }));
    expect(result.fired).toBe(false);
    expect(result.similarityScore).toBeNull();
  });

  it("fires at exact threshold boundary (below)", () => {
    // Two orthogonal vectors have similarity 0
    const result = checkPatternDeviation(
      makeCtx({
        featureVector: [1, 0, 0, 0, 0, 0, 0, 0, 0],
        baselineCentroid: [0, 1, 0, 0, 0, 0, 0, 0, 0],
        similarityThreshold: 0.5,
      }),
    );
    expect(result.fired).toBe(true);
    expect(result.similarityScore).toBeCloseTo(0);
  });
});
