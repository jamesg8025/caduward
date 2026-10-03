import type { DetectionRule } from "./types.js";

export const selfAccessRule: DetectionRule = {
  name: "self_access",
  check(ctx) {
    const fired = ctx.staff.patientId !== null && ctx.staff.patientId === ctx.event.patientId;
    return {
      rule: "self_access",
      fired,
      details: fired
        ? `Staff member ${ctx.staff.firstName} ${ctx.staff.lastName} accessed their own record`
        : undefined,
    };
  },
};
