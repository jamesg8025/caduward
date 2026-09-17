import { dormantReactivationRule } from "./dormant-reactivation.js";
import { noEncounterRule } from "./no-encounter.js";
import { offShiftRule } from "./off-shift.js";
import { relationshipSnoopRule } from "./relationship-snoop.js";
import { selfAccessRule } from "./self-access.js";
import type { DetectionRule, RuleContext, RuleResult } from "./types.js";
import { vipAccessRule } from "./vip-access.js";

export const DETECTION_RULES: DetectionRule[] = [
  noEncounterRule,
  offShiftRule,
  relationshipSnoopRule,
  vipAccessRule,
  selfAccessRule,
  dormantReactivationRule,
];

/** Run all detection rules against a context. Returns only the rules that fired. */
export function runRules(ctx: RuleContext): RuleResult[] {
  return DETECTION_RULES.map((rule) => rule.check(ctx)).filter((r) => r.fired);
}

export type {
  AccessEventRow,
  DetectionRule,
  PatientRow,
  RuleContext,
  RuleResult,
  StaffRow,
} from "./types.js";
