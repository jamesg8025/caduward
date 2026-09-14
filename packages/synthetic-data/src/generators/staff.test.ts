import { DEPARTMENTS, STAFF_ROLES } from "@caduward/shared";
import { describe, expect, it } from "vitest";
import type { TransformedPatient } from "../fhir/transform.js";
import { SeededRandom } from "../random.js";
import { generateStaff } from "./staff.js";

const SAMPLE_PATIENTS: TransformedPatient[] = [
  {
    id: "p1",
    firstName: "Alice",
    lastName: "Smith",
    dateOfBirth: "1985-03-15",
    address: "123 Main St, Springfield, MA, 01101",
    emergencyContact: "Bob Smith",
    isVip: false,
  },
  {
    id: "p2",
    firstName: "Carol",
    lastName: "Jones",
    dateOfBirth: "1970-07-22",
    address: "456 Oak Ave, Salem, CT, 06420",
    emergencyContact: null,
    isVip: true,
  },
  {
    id: "p3",
    firstName: "David",
    lastName: "Williams",
    dateOfBirth: "1990-11-30",
    address: "789 Elm St, Georgetown, NY, 10001",
    emergencyContact: "Eve Williams",
    isVip: false,
  },
];

describe("generateStaff", () => {
  it("generates the requested number of staff", () => {
    const rng = new SeededRandom(42);
    const staff = generateStaff(SAMPLE_PATIENTS, { staffCount: 50 }, rng);
    expect(staff).toHaveLength(50);
  });

  it("assigns valid roles from the defined set", () => {
    const rng = new SeededRandom(42);
    const staff = generateStaff(SAMPLE_PATIENTS, { staffCount: 100 }, rng);
    const roles = new Set(STAFF_ROLES);

    for (const s of staff) {
      expect(roles.has(s.role)).toBe(true);
    }
  });

  it("assigns valid departments", () => {
    const rng = new SeededRandom(42);
    const staff = generateStaff(SAMPLE_PATIENTS, { staffCount: 100 }, rng);
    const departments = new Set(DEPARTMENTS);

    for (const s of staff) {
      expect(departments.has(s.department)).toBe(true);
    }
  });

  it("generates relationship-snoop staff sharing last names with patients", () => {
    const rng = new SeededRandom(42);
    const staff = generateStaff(
      SAMPLE_PATIENTS,
      { staffCount: 100, relationshipSnoopRate: 0.1 },
      rng,
    );
    const patientLastNames = new Set(SAMPLE_PATIENTS.map((p) => p.lastName));

    const snoopStaff = staff.filter((s) => patientLastNames.has(s.lastName));
    expect(snoopStaff.length).toBeGreaterThanOrEqual(1);
  });

  it("generates self-access candidates mirroring patient identities", () => {
    const rng = new SeededRandom(42);
    const staff = generateStaff(SAMPLE_PATIENTS, { staffCount: 100, selfAccessRate: 0.05 }, rng);

    // At least some staff should share first+last name with a patient
    const patientNames = new Set(SAMPLE_PATIENTS.map((p) => `${p.firstName} ${p.lastName}`));
    const selfAccessStaff = staff.filter((s) => patientNames.has(`${s.firstName} ${s.lastName}`));
    expect(selfAccessStaff.length).toBeGreaterThanOrEqual(1);
  });

  it("generates dormant (inactive) staff", () => {
    const rng = new SeededRandom(42);
    const staff = generateStaff(SAMPLE_PATIENTS, { staffCount: 100, dormantRate: 0.1 }, rng);

    const inactiveStaff = staff.filter((s) => !s.isActive);
    expect(inactiveStaff.length).toBe(10);
  });

  it("assigns valid shift times", () => {
    const rng = new SeededRandom(42);
    const staff = generateStaff(SAMPLE_PATIENTS, { staffCount: 50 }, rng);

    const timePattern = /^\d{2}:\d{2}$/;
    for (const s of staff) {
      expect(s.shiftStart).toMatch(timePattern);
      expect(s.shiftEnd).toMatch(timePattern);
    }
  });

  it("produces deterministic output for the same seed", () => {
    const staffA = generateStaff(SAMPLE_PATIENTS, { staffCount: 20 }, new SeededRandom(42));
    const staffB = generateStaff(SAMPLE_PATIENTS, { staffCount: 20 }, new SeededRandom(42));

    expect(staffA).toEqual(staffB);
  });

  it("produces different output for different seeds", () => {
    const staffA = generateStaff(SAMPLE_PATIENTS, { staffCount: 20 }, new SeededRandom(42));
    const staffB = generateStaff(SAMPLE_PATIENTS, { staffCount: 20 }, new SeededRandom(99));

    const idsA = staffA.map((s) => s.id);
    const idsB = staffB.map((s) => s.id);
    expect(idsA).not.toEqual(idsB);
  });

  it("generates unique IDs for all staff", () => {
    const rng = new SeededRandom(42);
    const staff = generateStaff(SAMPLE_PATIENTS, { staffCount: 200 }, rng);

    const ids = staff.map((s) => s.id);
    expect(new Set(ids).size).toBe(200);
  });
});
