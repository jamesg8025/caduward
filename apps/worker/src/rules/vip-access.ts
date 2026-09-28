import type { DetectionRule } from "./types.js";

export const vipAccessRule: DetectionRule = {
  name: "vip_access",
  check(ctx) {
    // A directly linked encounter is definitive proof of legitimate care,
    // even if the staff's department doesn't match any recorded encounter department.
    const fired =
      ctx.patient.isVip &&
      !ctx.hasEncounterForStaffAndPatient &&
      ctx.event.linkedEncounterId === null;
    return {
      rule: "vip_access",
      fired,
      details: fired ? "VIP patient accessed without a documented care relationship" : undefined,
    };
  },
};
