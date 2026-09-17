import { describe, expect, it } from "vitest";
import type { AccessEventRow, PatientRow, StaffRow } from "../rules/types.js";
import { computeCentroid, cosineSimilarity } from "./compute.js";
import { computeFeatureVector } from "./features.js";

describe("computeFeatureVector", () => {
  const staff: StaffRow = {
    id: "s1",
    firstName: "Alice",
    lastName: "Smith",
    role: "nurse",
    department: "Emergency",
    shiftStart: "08:00",
    shiftEnd: "16:00",
    address: "123 Main St",
    isActive: true,
  };

  const patient: PatientRow = {
    id: "p1",
    firstName: "Bob",
    lastName: "Jones",
    address: "456 Oak Ave",
    emergencyContact: null,
    isVip: false,
  };

  it("produces a 9-dimensional vector", () => {
    const event: AccessEventRow = {
      id: "e1",
      staffId: "s1",
      patientId: "p1",
      timestamp: new Date("2025-01-15T10:00:00Z"), // Wed, hour 10
      accessType: "view",
      linkedEncounterId: "enc-1",
    };
    const v = computeFeatureVector(event, staff, patient, "Emergency");
    expect(v).toHaveLength(9);
  });

  it("normalizes hour and day correctly", () => {
    const event: AccessEventRow = {
      id: "e1",
      staffId: "s1",
      patientId: "p1",
      timestamp: new Date("2025-01-15T12:00:00Z"), // Wed (day 3), hour 12
      accessType: "view",
      linkedEncounterId: null,
    };
    const v = computeFeatureVector(event, staff, patient);
    expect(v[0]).toBeCloseTo(12 / 24);
    expect(v[1]).toBeCloseTo(3 / 7);
  });

  it("one-hot encodes access type correctly", () => {
    const makeEvent = (accessType: string) => ({
      id: "e1",
      staffId: "s1",
      patientId: "p1",
      timestamp: new Date("2025-01-15T10:00:00Z"),
      accessType,
      linkedEncounterId: null,
    });

    const viewV = computeFeatureVector(makeEvent("view"), staff, patient);
    expect(viewV.slice(2, 5)).toEqual([1, 0, 0]);

    const editV = computeFeatureVector(makeEvent("edit"), staff, patient);
    expect(editV.slice(2, 5)).toEqual([0, 1, 0]);

    const printV = computeFeatureVector(makeEvent("print"), staff, patient);
    expect(printV.slice(2, 5)).toEqual([0, 0, 1]);
  });

  it("sets binary features correctly", () => {
    const event: AccessEventRow = {
      id: "e1",
      staffId: "s1",
      patientId: "p1",
      timestamp: new Date("2025-01-15T10:00:00Z"),
      accessType: "view",
      linkedEncounterId: "enc-1",
    };
    const vipPatient = { ...patient, isVip: true };
    const v = computeFeatureVector(event, staff, vipPatient, "Emergency");

    expect(v[5]).toBe(1); // has encounter
    expect(v[6]).toBe(1); // is VIP
    expect(v[7]).toBe(1); // staff active
    expect(v[8]).toBe(1); // same department
  });

  it("sets same-department to 0 when departments differ", () => {
    const event: AccessEventRow = {
      id: "e1",
      staffId: "s1",
      patientId: "p1",
      timestamp: new Date("2025-01-15T10:00:00Z"),
      accessType: "view",
      linkedEncounterId: "enc-1",
    };
    const v = computeFeatureVector(event, staff, patient, "Cardiology");
    expect(v[8]).toBe(0);
  });
});

describe("computeCentroid", () => {
  it("computes the element-wise mean", () => {
    const vectors = [
      [1, 2, 3],
      [3, 4, 5],
      [5, 6, 7],
    ];
    const centroid = computeCentroid(vectors);
    expect(centroid).toEqual([3, 4, 5]);
  });

  it("returns the vector itself for a single input", () => {
    const centroid = computeCentroid([[1, 2, 3]]);
    expect(centroid).toEqual([1, 2, 3]);
  });

  it("throws for empty input", () => {
    expect(() => computeCentroid([])).toThrow();
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 when one vector is all zeros", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("is scale-invariant", () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6]; // 2x scaled
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });
});
