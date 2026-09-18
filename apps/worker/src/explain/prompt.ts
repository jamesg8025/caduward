import type { AnomalyType } from "@caduward/shared";

export interface FlagContext {
  flagId: string;
  triggeredRules: string[];
  severity: string;
  similarityScore: number | null;
  event: {
    timestamp: Date;
    accessType: string;
  };
  staff: {
    firstName: string;
    lastName: string;
    role: string;
    department: string;
    shiftStart: string;
    shiftEnd: string;
  };
  patient: {
    firstName: string;
    lastName: string;
    isVip: boolean;
  };
}

const RULE_DESCRIPTIONS: Record<string, string> = {
  no_encounter:
    "The staff member accessed this patient's record with no linked scheduled encounter (break-glass access).",
  off_shift: "The access occurred outside the staff member's assigned shift window.",
  relationship_snoop:
    "The staff member and patient share identifying attributes (last name, address, or emergency contact), suggesting a possible personal relationship.",
  vip_access:
    "The accessed patient is flagged as a VIP/high-profile individual, and the staff member has no documented care relationship.",
  self_access: "The staff member accessed their own patient record.",
  dormant_reactivation: "The access came from a staff account flagged as inactive or long-dormant.",
  pattern_deviation:
    "The access pattern deviates significantly from the typical behavior for this role and department.",
};

export function buildPrompt(ctx: FlagContext): string {
  const ruleDetails = ctx.triggeredRules
    .map((rule) => `- **${rule}**: ${RULE_DESCRIPTIONS[rule] ?? "Unknown rule."}`)
    .join("\n");

  const similarityNote =
    ctx.similarityScore !== null
      ? `\nSimilarity score (cosine distance from role baseline): ${ctx.similarityScore.toFixed(4)}`
      : "";

  return `You are a healthcare compliance analyst AI. Your job is to review flagged EHR (Electronic Health Record) access events and produce a clear, structured explanation for a compliance officer to review.

Analyze the following flagged access event and produce a JSON explanation.

## Flagged Access Event

- **Staff**: ${ctx.staff.firstName} ${ctx.staff.lastName} (${ctx.staff.role}, ${ctx.staff.department})
- **Shift window**: ${ctx.staff.shiftStart} – ${ctx.staff.shiftEnd}
- **Patient**: ${ctx.patient.firstName} ${ctx.patient.lastName}${ctx.patient.isVip ? " [VIP]" : ""}
- **Access time**: ${ctx.event.timestamp.toISOString()}
- **Access type**: ${ctx.event.accessType}
- **Severity**: ${ctx.severity}
- **Triggered rules**:
${ruleDetails}${similarityNote}

## Instructions

Respond with a JSON object containing exactly these three fields:
- "summary": A 1–3 sentence plain-language summary explaining why this access was flagged. Write for a non-technical compliance officer.
- "contributing_factors": An array of 1–5 short strings, each describing one specific factor that contributed to the flag.
- "recommended_action": A single sentence recommending the next step the compliance team should take.

Respond ONLY with the JSON object. No markdown fencing, no extra text.`;
}
