import type { DetectionRule } from "./types.js";

export const vipAccessRule: DetectionRule = {
  name: "vip_access",
  check(ctx) {
    const fired = ctx.patient.isVip && !ctx.hasEncounterForStaffAndPatient;
    return {
      rule: "vip_access",
      fired,
      details: fired ? "VIP patient accessed without a documented care relationship" : undefined,
    };
  },
};
