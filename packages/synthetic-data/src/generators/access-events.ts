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
  /** Fraction of normal events that are legitimate break-glass accesses (no linked encounter). */
  benignNoEncounterRate?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Only used when there are no encounters to draw activity dates from. */
const FALLBACK_BASE_DATE = new Date("2025-01-10T00:00:00Z");

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

function startOfUtcDay(date: Date): Date {
  const day = new Date(date.getTime());
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

/**
 * Midnight (UTC) of a randomly chosen encounter's day. Injected events draw their dates
 * from here so they share the normal-event date range instead of standing apart from it.
 */
function randomActivityDay(encounters: TransformedEncounter[], rng: SeededRandom): Date {
  if (encounters.length === 0) {
    return new Date(FALLBACK_BASE_DATE.getTime() + rng.int(0, 30) * MS_PER_DAY);
  }
  return startOfUtcDay(rng.pick(encounters).scheduledStart);
}

/** Pick a patient from the pool, never the staff member's own patient record. */
function pickPatientOtherThanSelf(
  pool: TransformedPatient[],
  staffMember: GeneratedStaff,
  rng: SeededRandom,
): TransformedPatient {
  if (staffMember.patientId === null) return rng.pick(pool);
  const others = pool.filter((p) => p.id !== staffMember.patientId);
  return rng.pick(others.length > 0 ? others : pool);
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

/**
 * Generate normal (non-anomalous) access events. A `benignNoEncounterRate` share of them
 * are legitimate break-glass accesses by Emergency staff with no linked encounter, so a
 * missing encounter is a signal rather than a perfect proxy for the ground-truth label.
 * Staff never access their own patient record here; that is reserved for self_access.
 */
export function generateNormalEvents(
  patients: TransformedPatient[],
  encounters: TransformedEncounter[],
  activeStaff: GeneratedStaff[],
  count: number,
  rng: SeededRandom,
  benignNoEncounterRate = 0,
): GeneratedAccessEvent[] {
  const encounterIndex = buildEncounterIndex(encounters);
  const events: GeneratedAccessEvent[] = [];

  // Find patients who have encounters
  const patientsWithEncounters = patients.filter(
    (p) => (encounterIndex.get(p.id)?.length ?? 0) > 0,
  );
  const carePool = patientsWithEncounters.length > 0 ? patientsWithEncounters : patients;

  const emergencyStaff = activeStaff.filter((s) => s.department === "Emergency");
  const breakGlassStaff = emergencyStaff.length > 0 ? emergencyStaff : activeStaff;
  const breakGlassCount = Math.floor(count * benignNoEncounterRate);

  for (let i = 0; i < breakGlassCount; i++) {
    const staffMember = rng.pick(breakGlassStaff);
    const patient = pickPatientOtherThanSelf(patients, staffMember, rng);
    const timestamp = randomActivityDay(encounters, rng);
    const shiftStart = parseTime(staffMember.shiftStart);
    timestamp.setUTCHours(shiftStart.hours + rng.int(0, 6), rng.int(0, 59));

    events.push({
      id: generateUuid(rng),
      staffId: staffMember.id,
      patientId: patient.id,
      timestamp,
      accessType: rng.weightedPick({ view: 0.8, edit: 0.15, print: 0.05 }),
      linkedEncounterId: null,
      isSeededAnomaly: false,
      seededAnomalyType: null,
    });
  }

  for (let i = breakGlassCount; i < count; i++) {
    const staffMember = rng.pick(activeStaff);
    const patient = pickPatientOtherThanSelf(carePool, staffMember, rng);
    const patientEncounters = encounterIndex.get(patient.id) ?? [];

    let encounter: TransformedEncounter | null = null;
    let timestamp: Date;

    if (patientEncounters.length > 0) {
      encounter = rng.pick(patientEncounters);
      // Access within 2 hours of encounter start
      const offsetMs = rng.int(-30, 120) * 60 * 1000;
      timestamp = new Date(encounter.scheduledStart.getTime() + offsetMs);
    } else {
      // Rare: patient without encounters; the shift-hour adjustment below sets the time
      timestamp = randomActivityDay(encounters, rng);
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

  const normalEvents = generateNormalEvents(
    patients,
    encounters,
    activeStaff,
    normalCount,
    rng,
    config.benignNoEncounterRate ?? 0,
  );

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

  // Find self-access candidates: staff linked to their own patient record
  const patientById = new Map(patients.map((p) => [p.id, p]));
  const selfAccessCandidates = activeStaff
    .map((s) => ({ staff: s, patient: s.patientId ? patientById.get(s.patientId) : undefined }))
    .filter(
      (c): c is { staff: GeneratedStaff; patient: TransformedPatient } => c.patient !== undefined,
    );

  const encounterIndex = buildEncounterIndex(encounters);
  const patientsWithEncounters = patients.filter((p) => encounterIndex.has(p.id));

  // Distribute anomalies by type
  const distribution = distributeAnomalies(totalAnomalies, anomalyMix);

  for (const [type, count] of Object.entries(distribution) as [AnomalyType, number][]) {
    for (let i = 0; i < count; i++) {
      const event = generateAnomalyByType(type, {
        patients,
        encounters,
        encounterIndex,
        carePool: patientsWithEncounters.length > 0 ? patientsWithEncounters : patients,
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
  encounterIndex: Map<string, TransformedEncounter[]>;
  /** Patients with at least one encounter (all patients if none have encounters). */
  carePool: TransformedPatient[];
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
    case "pattern_deviation":
      // pattern_deviation is a detection-side concept, not a seeded anomaly type
      return null;
  }
}

/** One of the patient's encounters, so the anomaly is not also given away by a missing link. */
function pickPatientEncounter(patientId: string, ctx: AnomalyContext): TransformedEncounter | null {
  const patientEncounters = ctx.encounterIndex.get(patientId) ?? [];
  return patientEncounters.length > 0 ? ctx.rng.pick(patientEncounters) : null;
}

function generateNoEncounterAnomaly(ctx: AnomalyContext): GeneratedAccessEvent {
  const staffMember = ctx.rng.pick(ctx.activeStaff);
  const patient = ctx.rng.pick(ctx.patients);
  const timestamp = randomActivityDay(ctx.encounters, ctx.rng);
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
  const patient = pickPatientOtherThanSelf(ctx.carePool, staffMember, ctx.rng);
  const encounter = pickPatientEncounter(patient.id, ctx);
  const timestamp = encounter
    ? startOfUtcDay(encounter.scheduledStart)
    : randomActivityDay(ctx.encounters, ctx.rng);

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
    linkedEncounterId: encounter?.id ?? null,
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

  const timestamp = randomActivityDay(ctx.encounters, ctx.rng);
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

  const timestamp = randomActivityDay(ctx.encounters, ctx.rng);
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

function generateSelfAccessAnomaly(ctx: AnomalyContext): GeneratedAccessEvent | null {
  // Without a staff member linked to a patient record there is no genuine self-access;
  // skip rather than emit an event whose label doesn't match what happened.
  if (ctx.selfAccessCandidates.length === 0) return null;
  const { staff: staffMember, patient } = ctx.rng.pick(ctx.selfAccessCandidates);

  const encounter = pickPatientEncounter(patient.id, ctx);
  const timestamp = encounter
    ? startOfUtcDay(encounter.scheduledStart)
    : randomActivityDay(ctx.encounters, ctx.rng);
  const shiftStart = parseTime(staffMember.shiftStart);
  timestamp.setUTCHours(shiftStart.hours + ctx.rng.int(0, 6), ctx.rng.int(0, 59));

  return {
    id: generateUuid(ctx.rng),
    staffId: staffMember.id,
    patientId: patient.id,
    timestamp,
    accessType: "view",
    linkedEncounterId: encounter?.id ?? null,
    isSeededAnomaly: true,
    seededAnomalyType: "self_access",
  };
}

function generateDormantReactivationAnomaly(ctx: AnomalyContext): GeneratedAccessEvent {
  const staffMember =
    ctx.inactiveStaff.length > 0 ? ctx.rng.pick(ctx.inactiveStaff) : ctx.rng.pick(ctx.activeStaff);
  const patient = ctx.rng.pick(ctx.carePool);
  const encounter = pickPatientEncounter(patient.id, ctx);
  const timestamp = encounter
    ? startOfUtcDay(encounter.scheduledStart)
    : randomActivityDay(ctx.encounters, ctx.rng);
  timestamp.setUTCHours(ctx.rng.int(0, 23), ctx.rng.int(0, 59));

  return {
    id: generateUuid(ctx.rng),
    staffId: staffMember.id,
    patientId: patient.id,
    timestamp,
    accessType: ctx.rng.pick(["view", "edit", "print"] as const),
    linkedEncounterId: encounter?.id ?? null,
    isSeededAnomaly: true,
    seededAnomalyType: "dormant_reactivation",
  };
}
