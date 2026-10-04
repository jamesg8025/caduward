import { describe, expect, it } from "vitest";
import type { TransformedEncounter, TransformedPatient } from "../fhir/transform.js";
import { SeededRandom } from "../random.js";
import { generateAccessEvents, generateNormalEvents, injectAnomalies } from "./access-events.js";
import type { GeneratedStaff } from "./staff.js";

const PATIENTS: TransformedPatient[] = [
  {
    id: "p1",
    firstName: "Alice",
    lastName: "Smith",
    dateOfBirth: "1985-03-15",
    address: "123 Main St, Springfield, MA, 01101",
    emergencyContact: "Bob Smith",
    isVip: true,
  },
  {
    id: "p2",
    firstName: "Carol",
    lastName: "Jones",
    dateOfBirth: "1970-07-22",
    address: "456 Oak Ave, Salem, CT, 06420",
    emergencyContact: null,
    isVip: false,
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

const ENCOUNTERS: TransformedEncounter[] = [
  {
    id: "enc1",
    patientId: "p1",
    provider: "Dr. Chen",
    department: "General Medicine",
    scheduledStart: new Date("2025-01-10T09:00:00Z"),
    scheduledEnd: new Date("2025-01-10T10:00:00Z"),
  },
  {
    id: "enc2",
    patientId: "p2",
    provider: "Dr. Park",
    department: "Emergency",
    scheduledStart: new Date("2025-01-11T14:00:00Z"),
    scheduledEnd: new Date("2025-01-11T15:00:00Z"),
  },
  {
    id: "enc3",
    patientId: "p1",
    provider: "Dr. Lee",
    department: "Cardiology",
    scheduledStart: new Date("2025-01-12T10:00:00Z"),
    scheduledEnd: new Date("2025-01-12T11:00:00Z"),
  },
];

const STAFF: GeneratedStaff[] = [
  {
    id: "s1",
    firstName: "Alice",
    lastName: "Smith",
    role: "nurse",
    department: "General Medicine",
    shiftStart: "06:00",
    shiftEnd: "14:00",
    address: "123 Main St, Springfield, MA, 01101",
    isActive: true,
    patientId: "p1", // Alice Smith is also patient p1
  },
  {
    id: "s2",
    firstName: "Eve",
    lastName: "Jones",
    role: "physician",
    department: "Emergency",
    shiftStart: "14:00",
    shiftEnd: "22:00",
    address: "222 Pine St, Riverside, MA, 02101",
    isActive: true,
    patientId: null,
  },
  {
    id: "s3",
    firstName: "Frank",
    lastName: "Brown",
    role: "admin",
    department: "Lab",
    shiftStart: "08:00",
    shiftEnd: "16:00",
    address: "333 Oak Ave, Lakewood, CT, 06001",
    isActive: true,
    patientId: null,
  },
  {
    id: "s4",
    firstName: "Grace",
    lastName: "Taylor",
    role: "lab_tech",
    department: "Lab",
    shiftStart: "22:00",
    shiftEnd: "06:00",
    address: "444 Elm St, Brookside, NY, 10002",
    isActive: false, // dormant
    patientId: null,
  },
];

describe("generateAccessEvents", () => {
  it("generates the requested total number of events", () => {
    const rng = new SeededRandom(42);
    const events = generateAccessEvents(
      PATIENTS,
      ENCOUNTERS,
      STAFF,
      {
        totalEvents: 100,
        anomalyRate: 0.1,
        anomalyMix: { no_encounter: 0.5, off_shift: 0.5 },
        timeWindowDays: 30,
      },
      rng,
    );

    expect(events).toHaveLength(100);
  });

  it("marks normal events as not anomalous", () => {
    const rng = new SeededRandom(42);
    const events = generateAccessEvents(
      PATIENTS,
      ENCOUNTERS,
      STAFF,
      {
        totalEvents: 50,
        anomalyRate: 0.0,
        anomalyMix: {},
        timeWindowDays: 30,
      },
      rng,
    );

    for (const event of events) {
      expect(event.isSeededAnomaly).toBe(false);
      expect(event.seededAnomalyType).toBeNull();
    }
  });

  it("includes anomalous events according to anomalyRate", () => {
    const rng = new SeededRandom(42);
    const events = generateAccessEvents(
      PATIENTS,
      ENCOUNTERS,
      STAFF,
      {
        totalEvents: 200,
        anomalyRate: 0.1,
        anomalyMix: { no_encounter: 1.0 },
        timeWindowDays: 30,
      },
      rng,
    );

    const anomalies = events.filter((e) => e.isSeededAnomaly);
    expect(anomalies).toHaveLength(20); // 200 * 0.1
  });

  it("produces deterministic output for the same seed", () => {
    const config = {
      totalEvents: 50,
      anomalyRate: 0.1,
      anomalyMix: { no_encounter: 0.5, off_shift: 0.5 } as Partial<Record<string, number>>,
      timeWindowDays: 30,
    };

    const eventsA = generateAccessEvents(PATIENTS, ENCOUNTERS, STAFF, config, new SeededRandom(42));
    const eventsB = generateAccessEvents(PATIENTS, ENCOUNTERS, STAFF, config, new SeededRandom(42));

    const idsA = eventsA.map((e) => e.id);
    const idsB = eventsB.map((e) => e.id);
    expect(idsA).toEqual(idsB);
  });

  it("does not let a missing encounter identify seeded anomalies", () => {
    const events = generateAccessEvents(
      PATIENTS,
      ENCOUNTERS,
      STAFF,
      {
        totalEvents: 1000,
        anomalyRate: 0.05,
        anomalyMix: { no_encounter: 0.5, off_shift: 0.5 },
        timeWindowDays: 30,
        benignNoEncounterRate: 0.01,
      },
      new SeededRandom(42),
    );

    // Neither "no encounter" nor "has encounter" lines up perfectly with the label
    expect(events.some((e) => !e.isSeededAnomaly && e.linkedEncounterId === null)).toBe(true);
    expect(events.some((e) => e.isSeededAnomaly && e.linkedEncounterId !== null)).toBe(true);
  });

  it("assigns valid access types to all events", () => {
    const rng = new SeededRandom(42);
    const events = generateAccessEvents(
      PATIENTS,
      ENCOUNTERS,
      STAFF,
      {
        totalEvents: 100,
        anomalyRate: 0.1,
        anomalyMix: { no_encounter: 1.0 },
        timeWindowDays: 30,
      },
      rng,
    );

    const validTypes = new Set(["view", "edit", "print"]);
    for (const event of events) {
      expect(validTypes.has(event.accessType)).toBe(true);
    }
  });
});

describe("generateNormalEvents", () => {
  const activeStaff = STAFF.filter((s) => s.isActive);

  it("never pairs a staff member with their own patient record", () => {
    const events = generateNormalEvents(
      PATIENTS,
      ENCOUNTERS,
      activeStaff,
      500,
      new SeededRandom(42),
      0.1,
    );

    expect(events.some((e) => e.staffId === "s1")).toBe(true);
    expect(events.filter((e) => e.staffId === "s1" && e.patientId === "p1")).toHaveLength(0);
  });

  it("emits benign break-glass events from Emergency staff with no linked encounter", () => {
    const events = generateNormalEvents(
      PATIENTS,
      ENCOUNTERS,
      activeStaff,
      100,
      new SeededRandom(42),
      0.1,
    );

    const unlinked = events.filter((e) => e.linkedEncounterId === null);
    expect(unlinked).toHaveLength(10);
    for (const event of unlinked) {
      expect(event.isSeededAnomaly).toBe(false);
      expect(event.staffId).toBe("s2"); // the only Emergency staff member
    }
  });

  it("links every event to an encounter when benignNoEncounterRate is 0", () => {
    const events = generateNormalEvents(
      PATIENTS,
      ENCOUNTERS,
      activeStaff,
      100,
      new SeededRandom(42),
    );

    expect(events.every((e) => e.linkedEncounterId !== null)).toBe(true);
  });
});

describe("injectAnomalies", () => {
  it("generates no_encounter anomalies with null linkedEncounterId", () => {
    const rng = new SeededRandom(42);
    const anomalies = injectAnomalies(PATIENTS, ENCOUNTERS, STAFF, 10, { no_encounter: 1.0 }, rng);

    expect(anomalies).toHaveLength(10);
    for (const event of anomalies) {
      expect(event.isSeededAnomaly).toBe(true);
      expect(event.seededAnomalyType).toBe("no_encounter");
      expect(event.linkedEncounterId).toBeNull();
    }
  });

  it("generates off_shift anomalies outside the staff shift window", () => {
    const rng = new SeededRandom(42);
    const anomalies = injectAnomalies(PATIENTS, ENCOUNTERS, STAFF, 20, { off_shift: 1.0 }, rng);

    expect(anomalies).toHaveLength(20);
    for (const event of anomalies) {
      expect(event.isSeededAnomaly).toBe(true);
      expect(event.seededAnomalyType).toBe("off_shift");
    }
  });

  it("generates vip_access anomalies targeting VIP patients", () => {
    const rng = new SeededRandom(42);
    const anomalies = injectAnomalies(PATIENTS, ENCOUNTERS, STAFF, 10, { vip_access: 1.0 }, rng);

    const vipIds = new Set(PATIENTS.filter((p) => p.isVip).map((p) => p.id));
    for (const event of anomalies) {
      expect(event.seededAnomalyType).toBe("vip_access");
      expect(vipIds.has(event.patientId)).toBe(true);
    }
  });

  it("generates self_access anomalies matching staff to their patient record", () => {
    const rng = new SeededRandom(42);
    const anomalies = injectAnomalies(PATIENTS, ENCOUNTERS, STAFF, 5, { self_access: 1.0 }, rng);

    // Staff s1 is linked to patient p1 via patientId
    expect(anomalies).toHaveLength(5);
    for (const event of anomalies) {
      expect(event.staffId).toBe("s1");
      expect(event.patientId).toBe("p1");
    }
  });

  it("skips self_access anomalies when no staff member is linked to a patient record", () => {
    const rng = new SeededRandom(42);
    const unlinkedStaff = STAFF.map((s) => ({ ...s, patientId: null }));
    const anomalies = injectAnomalies(
      PATIENTS,
      ENCOUNTERS,
      unlinkedStaff,
      5,
      { self_access: 1.0 },
      rng,
    );

    expect(anomalies).toHaveLength(0);
  });

  it.each(["off_shift", "self_access", "dormant_reactivation"] as const)(
    "links %s anomalies to one of the patient's encounters when one exists",
    (type) => {
      const rng = new SeededRandom(42);
      const anomalies = injectAnomalies(PATIENTS, ENCOUNTERS, STAFF, 20, { [type]: 1.0 }, rng);

      expect(anomalies.length).toBeGreaterThan(0);
      for (const event of anomalies) {
        const encounter = ENCOUNTERS.find((e) => e.id === event.linkedEncounterId);
        expect(encounter?.patientId).toBe(event.patientId);
      }
    },
  );

  it("draws anomaly dates from the encounter date range", () => {
    const rng = new SeededRandom(42);
    const anomalies = injectAnomalies(
      PATIENTS,
      ENCOUNTERS,
      STAFF,
      60,
      { no_encounter: 0.25, off_shift: 0.25, vip_access: 0.25, dormant_reactivation: 0.25 },
      rng,
    );

    const encounterDays = new Set(
      ENCOUNTERS.map((e) => e.scheduledStart.toISOString().slice(0, 10)),
    );
    for (const event of anomalies) {
      // Times may roll past midnight when a shift ends late, so allow the following day
      const day = event.timestamp.toISOString().slice(0, 10);
      const previousDay = new Date(event.timestamp.getTime() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      expect(encounterDays.has(day) || encounterDays.has(previousDay)).toBe(true);
    }
  });

  it("generates dormant_reactivation anomalies using inactive staff", () => {
    const rng = new SeededRandom(42);
    const anomalies = injectAnomalies(
      PATIENTS,
      ENCOUNTERS,
      STAFF,
      5,
      { dormant_reactivation: 1.0 },
      rng,
    );

    const inactiveIds = new Set(STAFF.filter((s) => !s.isActive).map((s) => s.id));
    for (const event of anomalies) {
      expect(event.seededAnomalyType).toBe("dormant_reactivation");
      expect(inactiveIds.has(event.staffId)).toBe(true);
    }
  });

  it("generates relationship_snoop anomalies with matching last names", () => {
    const rng = new SeededRandom(42);
    const anomalies = injectAnomalies(
      PATIENTS,
      ENCOUNTERS,
      STAFF,
      5,
      { relationship_snoop: 1.0 },
      rng,
    );

    for (const event of anomalies) {
      expect(event.seededAnomalyType).toBe("relationship_snoop");
      const staffMember = STAFF.find((s) => s.id === event.staffId);
      const patient = PATIENTS.find((p) => p.id === event.patientId);
      // When snoop candidates exist, staff and patient share last name
      if (staffMember && patient) {
        expect(staffMember.lastName).toBe(patient.lastName);
      }
    }
  });

  it("distributes anomalies according to the mix weights", () => {
    const rng = new SeededRandom(42);
    const anomalies = injectAnomalies(
      PATIENTS,
      ENCOUNTERS,
      STAFF,
      100,
      {
        no_encounter: 0.5,
        off_shift: 0.3,
        dormant_reactivation: 0.2,
      },
      rng,
    );

    const counts = new Map<string | null, number>();
    for (const e of anomalies) {
      counts.set(e.seededAnomalyType, (counts.get(e.seededAnomalyType) ?? 0) + 1);
    }

    expect(counts.get("no_encounter")).toBe(50);
    expect(counts.get("off_shift")).toBe(30);
    // Last bucket gets the remainder
    expect(counts.get("dormant_reactivation")).toBe(20);
  });
});
