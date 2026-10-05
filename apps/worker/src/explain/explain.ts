import { accessEvents, anomalyFlags, flagExplanations, patients, staff } from "@caduward/db";
import type { Database } from "@caduward/db";
import { flagExplanationSchema } from "@caduward/shared";
import { eq, isNull } from "drizzle-orm";
import { type FlagContext, buildPrompt } from "./prompt.js";
import type { ExplanationProvider } from "./providers.js";

export interface ExplainPassResult {
  totalProcessed: number;
  totalExplained: number;
  totalFailed: number;
}

const DEFAULT_MAX_RETRIES = 2;

/**
 * Parse and validate the raw LLM response against the explanation schema.
 * Strips markdown code fences if present.
 */
export function parseExplanationResponse(raw: string) {
  let cleaned = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(cleaned);
  return flagExplanationSchema.parse(parsed);
}

/**
 * Generate an explanation for a single flag, with retries on validation failure.
 */
export async function generateExplanation(
  provider: ExplanationProvider,
  ctx: FlagContext,
  maxRetries = DEFAULT_MAX_RETRIES,
): Promise<{ explanation: ReturnType<typeof flagExplanationSchema.parse>; rawResponse: string }> {
  const prompt = buildPrompt(ctx);

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const rawResponse = await provider.generate(prompt);

    try {
      const explanation = parseExplanationResponse(rawResponse);
      return { explanation, rawResponse };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Explanation validation failed after ${maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/**
 * Run the explanation pass over all unexplained flags.
 * For each anomaly flag without a corresponding flag_explanation,
 * generates an explanation via the LLM provider and persists it.
 */
export interface ExplainedFlag {
  flagId: string;
  severity: string;
  triggeredRules: string[];
  summary: string;
  createdAt: Date;
}

export async function runExplanationPass(
  database: Database,
  provider: ExplanationProvider,
  options?: { maxRetries?: number; onExplained?: (flag: ExplainedFlag) => void },
): Promise<ExplainPassResult> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

  let totalProcessed = 0;
  let totalExplained = 0;
  let totalFailed = 0;

  // Fetch all flags without explanations
  const unexplainedFlags = await database
    .select({
      flagId: anomalyFlags.id,
      triggeredRules: anomalyFlags.triggeredRules,
      severity: anomalyFlags.severity,
      similarityScore: anomalyFlags.similarityScore,
      accessEventId: anomalyFlags.accessEventId,
    })
    .from(anomalyFlags)
    .leftJoin(flagExplanations, eq(anomalyFlags.id, flagExplanations.flagId))
    .where(isNull(flagExplanations.id));

  for (const flag of unexplainedFlags) {
    totalProcessed++;

    // Fetch the access event with staff and patient context
    const [eventRow] = await database
      .select({
        timestamp: accessEvents.timestamp,
        accessType: accessEvents.accessType,
        staffFirstName: staff.firstName,
        staffLastName: staff.lastName,
        staffRole: staff.role,
        staffDepartment: staff.department,
        staffShiftStart: staff.shiftStart,
        staffShiftEnd: staff.shiftEnd,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        patientIsVip: patients.isVip,
      })
      .from(accessEvents)
      .innerJoin(staff, eq(accessEvents.staffId, staff.id))
      .innerJoin(patients, eq(accessEvents.patientId, patients.id))
      .where(eq(accessEvents.id, flag.accessEventId));

    if (!eventRow) {
      totalFailed++;
      console.error(`Access event ${flag.accessEventId} not found for flag ${flag.flagId}`);
      continue;
    }

    const ctx: FlagContext = {
      flagId: flag.flagId,
      triggeredRules: flag.triggeredRules,
      severity: flag.severity,
      similarityScore: flag.similarityScore,
      event: {
        timestamp: eventRow.timestamp,
        accessType: eventRow.accessType,
      },
      staff: {
        firstName: eventRow.staffFirstName,
        lastName: eventRow.staffLastName,
        role: eventRow.staffRole,
        department: eventRow.staffDepartment,
        shiftStart: eventRow.staffShiftStart,
        shiftEnd: eventRow.staffShiftEnd,
      },
      patient: {
        firstName: eventRow.patientFirstName,
        lastName: eventRow.patientLastName,
        isVip: eventRow.patientIsVip,
      },
    };

    try {
      const { explanation, rawResponse } = await generateExplanation(provider, ctx, maxRetries);

      await database.insert(flagExplanations).values({
        flagId: flag.flagId,
        summary: explanation.summary,
        contributingFactors: explanation.contributing_factors,
        recommendedAction: explanation.recommended_action,
        rawModelResponse: rawResponse,
      });

      totalExplained++;

      options?.onExplained?.({
        flagId: flag.flagId,
        severity: flag.severity,
        triggeredRules: flag.triggeredRules,
        summary: explanation.summary,
        createdAt: new Date(),
      });
    } catch (error) {
      totalFailed++;
      console.error(
        `Failed to explain flag ${flag.flagId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return { totalProcessed, totalExplained, totalFailed };
}
