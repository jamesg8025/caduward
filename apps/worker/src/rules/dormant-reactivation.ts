import type { DetectionRule } from "./types.js";

export const dormantReactivationRule: DetectionRule = {
  name: "dormant_reactivation",
  check(ctx) {
    const fired = !ctx.staff.isActive;
    return {
      rule: "dormant_reactivation",
      fired,
      details: fired
        ? `Inactive staff member ${ctx.staff.firstName} ${ctx.staff.lastName} accessed a record`
        : undefined,
    };
  },
};
