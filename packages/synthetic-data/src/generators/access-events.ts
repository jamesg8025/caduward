import type { AccessType, AnomalyType } from "@caduward/shared";
import type { TransformedEncounter, TransformedPatient } from "../fhir/transform.js";
import type { SeededRandom } from "../random.js";
import type { GeneratedStaff } from "./staff.js";

export interface GeneratedAccessEvent {
  id: string;
  staffId: string;
  patientId: string;
  timestamp: Date;
  accessType: AccessType;
  linkedEncounterId: string | null;
  isSeededAnomaly: boolean;
  seededAnomalyType: AnomalyType | null;
}

export interface AccessEventsConfig {
  totalEvents: number;
  anomalyRate: number;
  anomalyMix: Partial<Record<AnomalyType, number>>;
  timeWindowDays: number;
}

function generateUuid(rng: SeededRandom): string {
  const hex = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      result += "-";
    } else if (i === 14) {
      result += "4";
    } else if (i === 19) {
      result += hex[rng.int(8, 11)];
    } else {
      result += hex[rng.int(0, 15)];
    }
  }
  return result;
}

function buildEncounterIndex(
  encounters: TransformedEncounter[],
): Map<string, TransformedEncounter[]> {
  const index = new Map<string, TransformedEncounter[]>();
  for (const enc of encounters) {
    const existing = index.get(enc.patientId) ?? [];
    existing.push(enc);
    index.set(enc.patientId, existing);
  }
  return index;
}

function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map(Number);
  return { hours, minutes };
}

function isWithinShift(date: Date, shiftStart: string, shiftEnd: string): boolean {
  const hour = date.getUTCHours();
  const start = parseTime(shiftStart).hours;
  const end = parseTime(shiftEnd).hours;

  if (start < end) {
    return hour >= start && hour < end;
  }
  // Night shift wraps around midnight
  return hour >= start || hour < end;
}

export function generateNormalEvents(
  patients: TransformedPatient[],
  encounters: TransformedEncounter[],
  activeStaff: GeneratedStaff[],
  count: number,
  rng: SeededRandom,
): GeneratedAccessEvent[] {
  const encounterIndex = buildEncounterIndex(encounters);
  const events: GeneratedAccessEvent[] = [];

  for (let i = 0; i < count; i++) {
    const staffMember = rng.pick(activeStaff);

    // Find patients who have encounters
    const patientsWithEncounters = patients.filter(
      (p) => (encounterIndex.get(p.id)?.length ?? 0) > 0,
    );
    const patient = rng.pick(patientsWithEncounters.length > 0 ? patientsWithEncounters : patients);
    const patientEncounters = encounterIndex.get(patient.id) ?? [];

    let encounter: TransformedEncounter | null = null;
    let timestamp: Date;

    if (patientEncounters.length > 0) {
      encounter = rng.pick(patientEncounters);
      // Access within 2 hours of encounter start
      const offsetMs = rng.int(-30, 120) * 60 * 1000;
      timestamp = new Date(encounter.scheduledStart.getTime() + offsetMs);
    } else {
      // Rare: patient without encounters, pick a reasonable time during shift
      const shiftStart = parseTime(staffMember.shiftStart);
      const baseDate = new Date();
      baseDate.setUTCHours(shiftStart.hours + rng.int(0, 6), rng.int(0, 59), 0, 0);
      timestamp = baseDate;
    }

    // Adjust timestamp to be within staff shift
    const shiftStart = parseTime(staffMember.shiftStart);
    timestamp.setUTCHours(shiftStart.hours + rng.int(0, 6), rng.int(0, 59));

    events.push({
      id: generateUuid(rng),
      staffId: staffMember.id,
      patientId: patient.id,
      timestamp,
      accessType: rng.weightedPick({ view: 0.7, edit: 0.2, print: 0.1 }),
      linkedEncounterId: encounter?.id ?? null,
      isSeededAnomaly: false,
      seededAnomalyType: null,
    });
  }

  return events;
}

export function generateAccessEvents(
  patients: TransformedPatient[],
  encounters: TransformedEncounter[],
  staff: GeneratedStaff[],
  config: AccessEventsConfig,
  rng: SeededRandom,
): GeneratedAccessEvent[] {
  const activeStaff = staff.filter((s) => s.isActive);
  const anomalyCount = Math.floor(config.totalEvents * config.anomalyRate);
  const normalCount = config.totalEvents - anomalyCount;

  const normalEvents = generateNormalEvents(patients, encounters, activeStaff, normalCount, rng);

  const anomalousEvents = injectAnomalies(
    patients,
    encounters,
    staff,
    anomalyCount,
    config.anomalyMix,
    rng,
  );

  const allEvents = [...normalEvents, ...anomalousEvents];
  return rng.shuffle(allEvents);
}

export function injectAnomalies(
  patients: TransformedPatient[],
  encounters: TransformedEncounter[],
  staff: GeneratedStaff[],
  totalAnomalies: number,
  anomalyMix: Partial<Record<AnomalyType, number>>,
  rng: SeededRandom,
): GeneratedAccessEvent[] {
  const events: GeneratedAccessEvent[] = [];
  const activeStaff = staff.filter((s) => s.isActive);
  const inactiveStaff = staff.filter((s) => !s.isActive);
  const vipPatients = patients.filter((p) => p.isVip);

  // Find relationship-snoop candidates
  const patientLastNames = new Set(patients.map((p) => p.lastName));
  const snoopStaff = activeStaff.filter((s) => patientLastNames.has(s.lastName));

  // Find self-access candidates
  const patientNameMap = new Map(patients.map((p) => [`${p.firstName} ${p.lastName}`, p]));
  const selfAccessCandidates = activeStaff
    .map((s) => ({ staff: s, patient: patientNameMap.get(`${s.firstName} ${s.lastName}`) }))
    .filter(
      (c): c is { staff: GeneratedStaff; patient: TransformedPatient } => c.patient !== undefined,
    );

  // Distribute anomalies by type
  const distribution = distributeAnomalies(totalAnomalies, anomalyMix);

  for (const [type, count] of Object.entries(distribution) as [AnomalyType, number][]) {
    for (let i = 0; i < count; i++) {
      const event = generateAnomalyByType(type, {
        patients,
        encounters,
        activeStaff,
        inactiveStaff,
        vipPatients,
        snoopStaff,
        selfAccessCandidates,
        rng,
      });
      if (event) events.push(event);
    }
  }

  return events;
}

function distributeAnomalies(
  total: number,
  mix: Partial<Record<AnomalyType, number>>,
): Record<string, number> {
  const result: Record<string, number> = {};
  let remaining = total;

  const entries = Object.entries(mix) as [AnomalyType, number][];
  for (let i = 0; i < entries.length; i++) {
    const [type, weight] = entries[i];
    if (i === entries.length - 1) {
      result[type] = remaining;
    } else {
      const count = Math.floor(total * weight);
      result[type] = count;
      remaining -= count;
    }
  }

  return result;
}

interface AnomalyContext {
  patients: TransformedPatient[];
  encounters: TransformedEncounter[];
  activeStaff: GeneratedStaff[];
  inactiveStaff: GeneratedStaff[];
  vipPatients: TransformedPatient[];
  snoopStaff: GeneratedStaff[];
  selfAccessCandidates: Array<{ staff: GeneratedStaff; patient: TransformedPatient }>;
  rng: SeededRandom;
}

function generateAnomalyByType(
  type: AnomalyType,
  ctx: AnomalyContext,
): GeneratedAccessEvent | null {
  switch (type) {
    case "no_encounter":
      return generateNoEncounterAnomaly(ctx);
    case "off_shift":
      return generateOffShiftAnomaly(ctx);
    case "relationship_snoop":
      return generateRelationshipSnoopAnomaly(ctx);
    case "vip_access":
      return generateVipAccessAnomaly(ctx);
    case "self_access":
      return generateSelfAccessAnomaly(ctx);
    case "dormant_reactivation":
      return generateDormantReactivationAnomaly(ctx);
  }
}

function generateNoEncounterAnomaly(ctx: AnomalyContext): GeneratedAccessEvent {
  const staffMember = ctx.rng.pick(ctx.activeStaff);
  const patient = ctx.rng.pick(ctx.patients);
  const baseDate = new Date("2025-01-10T00:00:00Z");
  const timestamp = new Date(baseDate.getTime() + ctx.rng.int(0, 30) * 24 * 60 * 60 * 1000);
  const shiftStart = parseTime(staffMember.shiftStart);
  timestamp.setUTCHours(shiftStart.hours + ctx.rng.int(0, 6), ctx.rng.int(0, 59));

  return {
    id: generateUuid(ctx.rng),
    staffId: staffMember.id,
    patientId: patient.id,
    timestamp,
    accessType: ctx.rng.pick(["view", "edit", "print"] as const),
    linkedEncounterId: null,
    isSeededAnomaly: true,
    seededAnomalyType: "no_encounter",
  };
}

function generateOffShiftAnomaly(ctx: AnomalyContext): GeneratedAccessEvent {
  const staffMember = ctx.rng.pick(ctx.activeStaff);
  const patient = ctx.rng.pick(ctx.patients);
  const baseDate = new Date("2025-01-10T00:00:00Z");
  const timestamp = new Date(baseDate.getTime() + ctx.rng.int(0, 30) * 24 * 60 * 60 * 1000);

  // Set time outside shift
  const shiftEnd = parseTime(staffMember.shiftEnd);
  const offShiftHour = (shiftEnd.hours + ctx.rng.int(2, 6)) % 24;
  timestamp.setUTCHours(offShiftHour, ctx.rng.int(0, 59));

  // Verify it's actually outside the shift
  if (isWithinShift(timestamp, staffMember.shiftStart, staffMember.shiftEnd)) {
    const shiftStart = parseTime(staffMember.shiftStart);
    timestamp.setUTCHours((shiftStart.hours + 12) % 24, ctx.rng.int(0, 59));
  }

  return {
    id: generateUuid(ctx.rng),
    staffId: staffMember.id,
    patientId: patient.id,
    timestamp,
    accessType: ctx.rng.pick(["view", "edit", "print"] as const),
    linkedEncounterId: null,
    isSeededAnomaly: true,
    seededAnomalyType: "off_shift",
  };
}

function generateRelationshipSnoopAnomaly(ctx: AnomalyContext): GeneratedAccessEvent {
  const candidates = ctx.snoopStaff.length > 0 ? ctx.snoopStaff : ctx.activeStaff;
  const staffMember = ctx.rng.pick(candidates);

  // Find a patient sharing the last name
  const matchingPatients = ctx.patients.filter((p) => p.lastName === staffMember.lastName);
  const patient =
    matchingPatients.length > 0 ? ctx.rng.pick(matchingPatients) : ctx.rng.pick(ctx.patients);

  const baseDate = new Date("2025-01-10T00:00:00Z");
  const timestamp = new Date(baseDate.getTime() + ctx.rng.int(0, 30) * 24 * 60 * 60 * 1000);
  const shiftStart = parseTime(staffMember.shiftStart);
  timestamp.setUTCHours(shiftStart.hours + ctx.rng.int(0, 6), ctx.rng.int(0, 59));

  return {
    id: generateUuid(ctx.rng),
    staffId: staffMember.id,
    patientId: patient.id,
    timestamp,
    accessType: "view",
    linkedEncounterId: null,
    isSeededAnomaly: true,
    seededAnomalyType: "relationship_snoop",
  };
}

function generateVipAccessAnomaly(ctx: AnomalyContext): GeneratedAccessEvent {
  const patient =
    ctx.vipPatients.length > 0 ? ctx.rng.pick(ctx.vipPatients) : ctx.rng.pick(ctx.patients);
  const staffMember = ctx.rng.pick(ctx.activeStaff);

  const baseDate = new Date("2025-01-10T00:00:00Z");
  const timestamp = new Date(baseDate.getTime() + ctx.rng.int(0, 30) * 24 * 60 * 60 * 1000);
  const shiftStart = parseTime(staffMember.shiftStart);
  timestamp.setUTCHours(shiftStart.hours + ctx.rng.int(0, 6), ctx.rng.int(0, 59));

  return {
    id: generateUuid(ctx.rng),
    staffId: staffMember.id,
    patientId: patient.id,
    timestamp,
    accessType: "view",
    linkedEncounterId: null,
    isSeededAnomaly: true,
    seededAnomalyType: "vip_access",
  };
}

function generateSelfAccessAnomaly(ctx: AnomalyContext): GeneratedAccessEvent {
  let staffMember: GeneratedStaff;
  let patient: TransformedPatient;

  if (ctx.selfAccessCandidates.length > 0) {
    const candidate = ctx.rng.pick(ctx.selfAccessCandidates);
    staffMember = candidate.staff;
    patient = candidate.patient;
  } else {
    // Fallback: pick any staff and any patient
    staffMember = ctx.rng.pick(ctx.activeStaff);
    patient = ctx.rng.pick(ctx.patients);
  }

  const baseDate = new Date("2025-01-10T00:00:00Z");
  const timestamp = new Date(baseDate.getTime() + ctx.rng.int(0, 30) * 24 * 60 * 60 * 1000);
  const shiftStart = parseTime(staffMember.shiftStart);
  timestamp.setUTCHours(shiftStart.hours + ctx.rng.int(0, 6), ctx.rng.int(0, 59));

  return {
    id: generateUuid(ctx.rng),
    staffId: staffMember.id,
    patientId: patient.id,
    timestamp,
    accessType: "view",
    linkedEncounterId: null,
    isSeededAnomaly: true,
    seededAnomalyType: "self_access",
  };
}

function generateDormantReactivationAnomaly(ctx: AnomalyContext): GeneratedAccessEvent {
  const staffMember =
    ctx.inactiveStaff.length > 0 ? ctx.rng.pick(ctx.inactiveStaff) : ctx.rng.pick(ctx.activeStaff);
  const patient = ctx.rng.pick(ctx.patients);

  const baseDate = new Date("2025-01-10T00:00:00Z");
  const timestamp = new Date(baseDate.getTime() + ctx.rng.int(0, 30) * 24 * 60 * 60 * 1000);
  timestamp.setUTCHours(ctx.rng.int(0, 23), ctx.rng.int(0, 59));

  return {
    id: generateUuid(ctx.rng),
    staffId: staffMember.id,
    patientId: patient.id,
    timestamp,
    accessType: ctx.rng.pick(["view", "edit", "print"] as const),
    linkedEncounterId: null,
    isSeededAnomaly: true,
    seededAnomalyType: "dormant_reactivation",
  };
}
