import { describe, expect, it } from "vitest";
import { transformBundle } from "./transform.js";
import type { FhirBundle } from "./types.js";

function makeBundle(patients: object[], encounters: object[]): FhirBundle {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: [...patients.map((p) => ({ resource: p })), ...encounters.map((e) => ({ resource: e }))],
  } as FhirBundle;
}

const PATIENT_A = {
  resourceType: "Patient" as const,
  id: "patient-1",
  name: [{ family: "Smith", given: ["Alice"] }],
  birthDate: "1985-03-15",
  address: [{ line: ["123 Main St"], city: "Springfield", state: "MA", postalCode: "01101" }],
  contact: [
    {
      relationship: [{ text: "Emergency Contact" }],
      name: { family: "Smith", given: ["Bob"] },
    },
  ],
};

const PATIENT_B = {
  resourceType: "Patient" as const,
  id: "patient-2",
  name: [{ family: "Jones", given: ["Carol"] }],
  birthDate: "1970-07-22",
};

const ENCOUNTER_A = {
  resourceType: "Encounter" as const,
  id: "enc-1",
  subject: { reference: "Patient/patient-1" },
  participant: [{ individual: { display: "Dr. Chen" } }],
  class: { code: "ambulatory" },
  period: {
    start: "2025-01-10T09:00:00Z",
    end: "2025-01-10T10:00:00Z",
  },
};

const ENCOUNTER_B = {
  resourceType: "Encounter" as const,
  id: "enc-2",
  subject: { reference: "Patient/patient-2" },
  class: { code: "emergency" },
  period: {
    start: "2025-01-11T14:00:00Z",
  },
};

describe("transformBundle", () => {
  it("extracts patients with correct fields", () => {
    const bundle = makeBundle([PATIENT_A], []);
    const { patients } = transformBundle(bundle);

    expect(patients).toHaveLength(1);
    expect(patients[0]).toEqual({
      id: "patient-1",
      firstName: "Alice",
      lastName: "Smith",
      dateOfBirth: "1985-03-15",
      address: "123 Main St, Springfield, MA, 01101",
      emergencyContact: "Bob Smith",
      isVip: true, // first patient with vipRate=0.02 -> ceil(1*0.02)=1, index 0 < 1
    });
  });

  it("handles patients without address or contact", () => {
    const bundle = makeBundle([PATIENT_B], []);
    const { patients } = transformBundle(bundle);

    expect(patients).toHaveLength(1);
    expect(patients[0].address).toBe("Unknown");
    expect(patients[0].emergencyContact).toBeNull();
  });

  it("extracts encounters with correct fields", () => {
    const bundle = makeBundle([PATIENT_A], [ENCOUNTER_A]);
    const { encounters } = transformBundle(bundle);

    expect(encounters).toHaveLength(1);
    expect(encounters[0]).toMatchObject({
      id: "enc-1",
      patientId: "patient-1",
      provider: "Dr. Chen",
      department: "General Medicine",
    });
    expect(encounters[0].scheduledStart).toBeInstanceOf(Date);
    expect(encounters[0].scheduledEnd).toBeInstanceOf(Date);
  });

  it("defaults encounter end to 1 hour after start when missing", () => {
    const bundle = makeBundle([PATIENT_B], [ENCOUNTER_B]);
    const { encounters } = transformBundle(bundle);

    expect(encounters).toHaveLength(1);
    const diffMs = encounters[0].scheduledEnd.getTime() - encounters[0].scheduledStart.getTime();
    expect(diffMs).toBe(60 * 60 * 1000);
  });

  it("maps emergency encounter class to Emergency department", () => {
    const bundle = makeBundle([PATIENT_B], [ENCOUNTER_B]);
    const { encounters } = transformBundle(bundle);

    expect(encounters[0].department).toBe("Emergency");
  });

  it("filters out encounters referencing unknown patients", () => {
    const orphanEncounter = {
      ...ENCOUNTER_A,
      id: "enc-orphan",
      subject: { reference: "Patient/nonexistent" },
    };
    const bundle = makeBundle([PATIENT_A], [orphanEncounter]);
    const { encounters } = transformBundle(bundle);

    expect(encounters).toHaveLength(0);
  });

  it("skips encounters without a period.start", () => {
    const noPeriod = {
      resourceType: "Encounter" as const,
      id: "enc-nope",
      subject: { reference: "Patient/patient-1" },
    };
    const bundle = makeBundle([PATIENT_A], [noPeriod]);
    const { encounters } = transformBundle(bundle);

    expect(encounters).toHaveLength(0);
  });

  it("ignores non-Patient/Encounter resources in the bundle", () => {
    const bundle = makeBundle([PATIENT_A], [ENCOUNTER_A]);
    bundle.entry.push({
      resource: { resourceType: "Condition" },
    });
    const { patients, encounters } = transformBundle(bundle);

    expect(patients).toHaveLength(1);
    expect(encounters).toHaveLength(1);
  });

  it("assigns VIP status based on vipRate", () => {
    const patients = Array.from({ length: 10 }, (_, i) => ({
      ...PATIENT_A,
      id: `p-${i}`,
    }));
    const bundle = makeBundle(patients, []);
    const { patients: result } = transformBundle(bundle, 0.3);

    const vipCount = result.filter((p) => p.isVip).length;
    expect(vipCount).toBe(3); // ceil(10 * 0.3)
  });
});
