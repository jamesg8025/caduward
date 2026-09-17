import {
  accessEvents,
  anomalyFlags,
  encounters,
  patients,
  roleBaselines,
  staff,
} from "@caduward/db";
import type { AnomalyType } from "@caduward/shared";
import { eq, inArray, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
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
 */
export async function runDetectionPass(
  database: PostgresJsDatabase,
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

  let hasMore = true;
  let offset = 0;

  while (hasMore) {
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
      .where(isNull(anomalyFlags.id))
      .limit(batchSize)
      .offset(offset);

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

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

    // If the batch was full, there may be more
    if (batch.length < batchSize) {
      hasMore = false;
    } else {
      // Since we're filtering unflagged events only, newly flagged ones won't
      // appear again. But offset-based pagination with a LEFT JOIN filter
      // can miss rows if the underlying set shrinks. Use offset=0 to re-query
      // from the beginning each batch (the WHERE filter excludes already-flagged).
      offset = 0;
    }
  }

  return { totalProcessed, totalFlagged, ruleBreakdown };
}
