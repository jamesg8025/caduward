import type { AnomalyType, Severity } from "@caduward/shared";

const HIGH_SEVERITY_RULES: ReadonlySet<AnomalyType> = new Set(["self_access", "vip_access"]);

const MEDIUM_SEVERITY_RULES: ReadonlySet<AnomalyType> = new Set([
  "off_shift",
  "relationship_snoop",
  "vip_access",
  "pattern_deviation",
]);

/**
 * Compute severity from the set of triggered rules (FR-12).
 *
 * - critical: 3+ rules, or self_access combined with any other rule
 * - high: 2 rules, or self_access alone, or vip_access alone
 * - medium: 1 rule that is off_shift, relationship_snoop, vip_access, or pattern_deviation
 * - low: 1 rule that is no_encounter or dormant_reactivation alone
 */
export function computeSeverity(firedRules: AnomalyType[]): Severity {
  if (firedRules.length === 0) {
    return "low";
  }

  if (firedRules.length >= 3) {
    return "critical";
  }

  const hasRule = (r: AnomalyType) => firedRules.includes(r);

  // self_access + anything else is critical
  if (hasRule("self_access") && firedRules.length > 1) {
    return "critical";
  }

  if (firedRules.length >= 2) {
    return "high";
  }

  // Single rule
  const rule = firedRules[0];

  if (HIGH_SEVERITY_RULES.has(rule)) {
    return "high";
  }

  if (MEDIUM_SEVERITY_RULES.has(rule)) {
    return "medium";
  }

  // no_encounter, dormant_reactivation alone
  return "low";
}
