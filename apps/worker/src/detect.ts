import {
  accessEvents,
  anomalyFlags,
  encounters,
  patients,
  roleBaselines,
  staff,
} from "@caduward/db";
import type { Database } from "@caduward/db";
import type { AnomalyType } from "@caduward/shared";
import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import { computeFeatureVector } from "./baselines/features.js";
import { runRules } from "./rules/index.js";
import { checkPatternDeviation } from "./rules/pattern-deviation.js";
import type { AccessEventRow, PatientRow, StaffRow } from "./rules/types.js";
import { computeSeverity } from "./severity.js";

export interface DetectionPassResult {
  totalProcessed: number;
  totalFlagged: number;
  ruleBreakdown: Record<string, number>;
}

const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

/**
 * Run a detection pass over all unprocessed access events.
 * Fetches events in batches, runs rule-based checks and pattern-deviation,
 * then writes anomaly_flags for events that trigger at least one rule.
 *
 * Batches are paged by keyset (ordered by event id, resuming after the last id
 * seen), so each unflagged event is evaluated exactly once per pass regardless
 * of how many flags earlier batches inserted.
 */
export async function runDetectionPass(
  database: Database,
  options?: { batchSize?: number; similarityThreshold?: number },
): Promise<DetectionPassResult> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const similarityThreshold = options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;

  let totalProcessed = 0;
  let totalFlagged = 0;
  const ruleBreakdown: Record<string, number> = {};

  // Load all role baselines into memory
  const baselines = await database.select().from(roleBaselines);
  const baselineMap = new Map<string, number[]>();
  for (const b of baselines) {
    baselineMap.set(`${b.role}::${b.department}`, b.centroid);
  }

  let lastSeenId: string | null = null;

  while (true) {
    // Fetch a batch of unprocessed events (ground-truth fields excluded from select)
    const batch = await database
      .select({
        id: accessEvents.id,
        staffId: accessEvents.staffId,
        patientId: accessEvents.patientId,
        timestamp: accessEvents.timestamp,
        accessType: accessEvents.accessType,
        linkedEncounterId: accessEvents.linkedEncounterId,
      })
      .from(accessEvents)
      .leftJoin(anomalyFlags, eq(accessEvents.id, anomalyFlags.accessEventId))
      .where(
        lastSeenId === null
          ? isNull(anomalyFlags.id)
          : and(isNull(anomalyFlags.id), gt(accessEvents.id, lastSeenId)),
      )
      .orderBy(asc(accessEvents.id))
      .limit(batchSize);

    if (batch.length === 0) break;

    // Collect unique staff and patient IDs
    const staffIds = [...new Set(batch.map((e) => e.staffId))];
    const patientIds = [...new Set(batch.map((e) => e.patientId))];

    // Eagerly load staff and patient rows
    const staffRows = await database.select().from(staff).where(inArray(staff.id, staffIds));
    const staffMap = new Map<string, StaffRow>(staffRows.map((s) => [s.id, s]));

    const patientRows = await database
      .select()
      .from(patients)
      .where(inArray(patients.id, patientIds));
    const patientMap = new Map<string, PatientRow>(patientRows.map((p) => [p.id, p]));

    // Precompute encounter relationships: for each (patientId, staffDepartment),
    // does any encounter exist for that patient in that department?
    const encounterRows = await database
      .select({
        patientId: encounters.patientId,
        department: encounters.department,
      })
      .from(encounters)
      .where(inArray(encounters.patientId, patientIds));

    const encounterSet = new Set<string>();
    const encounterDeptMap = new Map<string, string>();
    for (const enc of encounterRows) {
      encounterSet.add(`${enc.patientId}::${enc.department}`);
    }

    // Build encounter department lookup for feature vectors
    // Map linkedEncounterId -> department
    const linkedEncounterIds = batch
      .map((e) => e.linkedEncounterId)
      .filter((id): id is string => id !== null);

    if (linkedEncounterIds.length > 0) {
      const linkedEncounters = await database
        .select({ id: encounters.id, department: encounters.department })
        .from(encounters)
        .where(inArray(encounters.id, linkedEncounterIds));

      for (const enc of linkedEncounters) {
        encounterDeptMap.set(enc.id, enc.department);
      }
    }

    // Process each event
    const flagsToInsert: Array<{
      accessEventId: string;
      triggeredRules: string[];
      severity: "low" | "medium" | "high" | "critical";
      similarityScore: number | null;
    }> = [];

    for (const event of batch) {
      const staffRow = staffMap.get(event.staffId);
      const patientRow = patientMap.get(event.patientId);

      if (!staffRow || !patientRow) continue;

      const hasEncounter = encounterSet.has(`${event.patientId}::${staffRow.department}`);

      const ruleResults = runRules({
        event,
        staff: staffRow,
        patient: patientRow,
        hasEncounterForStaffAndPatient: hasEncounter,
      });

      // Pattern deviation check
      const encounterDept = event.linkedEncounterId
        ? encounterDeptMap.get(event.linkedEncounterId)
        : undefined;
      const featureVector = computeFeatureVector(event, staffRow, patientRow, encounterDept);
      const baselineKey = `${staffRow.role}::${staffRow.department}`;
      const centroid = baselineMap.get(baselineKey) ?? null;

      const patternResult = checkPatternDeviation({
        event,
        staff: staffRow,
        patient: patientRow,
        hasEncounterForStaffAndPatient: hasEncounter,
        featureVector,
        baselineCentroid: centroid,
        similarityThreshold,
      });

      const allFiredRules = [...ruleResults];
      if (patternResult.fired) {
        allFiredRules.push(patternResult);
      }

      if (allFiredRules.length > 0) {
        const triggeredRuleNames = allFiredRules.map((r) => r.rule);
        const severity = computeSeverity(triggeredRuleNames as AnomalyType[]);

        flagsToInsert.push({
          accessEventId: event.id,
          triggeredRules: triggeredRuleNames,
          severity,
          similarityScore: patternResult.similarityScore,
        });

        for (const r of triggeredRuleNames) {
          ruleBreakdown[r] = (ruleBreakdown[r] ?? 0) + 1;
        }
      }
    }

    // Batch insert flags
    if (flagsToInsert.length > 0) {
      await database.insert(anomalyFlags).values(flagsToInsert);
    }

    totalProcessed += batch.length;
    totalFlagged += flagsToInsert.length;

    if (batch.length < batchSize) break;
    lastSeenId = batch[batch.length - 1].id;
  }

  return { totalProcessed, totalFlagged, ruleBreakdown };
}
