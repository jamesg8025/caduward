import type { DEPARTMENTS } from "@caduward/shared";
import type { FhirBundle, FhirEncounter, FhirPatient } from "./types.js";

export interface TransformedPatient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: string;
  emergencyContact: string | null;
  isVip: boolean;
}

export interface TransformedEncounter {
  id: string;
  patientId: string;
  provider: string;
  department: (typeof DEPARTMENTS)[number];
  scheduledStart: Date;
  scheduledEnd: Date;
}

export interface TransformResult {
  patients: TransformedPatient[];
  encounters: TransformedEncounter[];
}

const DEPARTMENT_MAP: Record<string, (typeof DEPARTMENTS)[number]> = {
  ambulatory: "General Medicine",
  outpatient: "General Medicine",
  inpatient: "General Medicine",
  emergency: "Emergency",
  wellness: "General Medicine",
};

function formatAddress(addr?: {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
}): string {
  if (!addr) return "Unknown";
  const parts = [...(addr.line ?? []), addr.city, addr.state, addr.postalCode].filter(Boolean);
  return parts.join(", ") || "Unknown";
}

function extractPatientRef(reference: string): string {
  return reference.replace(/^Patient\//, "").replace(/^urn:uuid:/, "");
}

function transformPatient(
  fhir: FhirPatient,
  vipRate: number,
  index: number,
  totalPatients: number,
): TransformedPatient {
  const name = fhir.name[0];
  const emergencyContact = fhir.contact?.[0]?.name
    ? `${fhir.contact[0].name.given.join(" ")} ${fhir.contact[0].name.family}`
    : null;

  return {
    id: fhir.id,
    firstName: name.given[0],
    lastName: name.family,
    dateOfBirth: fhir.birthDate,
    address: formatAddress(fhir.address?.[0]),
    emergencyContact,
    isVip: index < Math.ceil(totalPatients * vipRate),
  };
}

function getEncounterClass(encounter: FhirEncounter): string {
  if (!encounter.class) return "ambulatory";
  if ("code" in encounter.class) return encounter.class.code ?? "ambulatory";
  if ("coding" in encounter.class) return encounter.class.coding?.[0]?.code ?? "ambulatory";
  return "ambulatory";
}

function transformEncounter(fhir: FhirEncounter): TransformedEncounter | null {
  if (!fhir.period?.start) return null;

  const patientId = extractPatientRef(fhir.subject.reference);
  const encounterClass = getEncounterClass(fhir);
  const department = DEPARTMENT_MAP[encounterClass] ?? "General Medicine";
  const provider = fhir.participant?.[0]?.individual?.display ?? "Dr. Unknown";

  const start = new Date(fhir.period.start);
  const end = fhir.period.end
    ? new Date(fhir.period.end)
    : new Date(start.getTime() + 60 * 60 * 1000);

  return {
    id: fhir.id,
    patientId,
    provider,
    department,
    scheduledStart: start,
    scheduledEnd: end,
  };
}

export function transformBundle(bundle: FhirBundle, vipRate = 0.02): TransformResult {
  const fhirPatients: FhirPatient[] = [];
  const fhirEncounters: FhirEncounter[] = [];

  for (const entry of bundle.entry) {
    if (entry.resource.resourceType === "Patient") {
      fhirPatients.push(entry.resource as FhirPatient);
    } else if (entry.resource.resourceType === "Encounter") {
      fhirEncounters.push(entry.resource as FhirEncounter);
    }
  }

  const patientIds = new Set(fhirPatients.map((p) => p.id));

  const patients = fhirPatients.map((p, i) => transformPatient(p, vipRate, i, fhirPatients.length));

  const encounters = fhirEncounters
    .map(transformEncounter)
    .filter((e): e is TransformedEncounter => e !== null && patientIds.has(e.patientId));

  return { patients, encounters };
}
