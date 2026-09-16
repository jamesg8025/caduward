import type { DetectionRule } from "./types.js";

export const selfAccessRule: DetectionRule = {
  name: "self_access",
  check(ctx) {
    const fired =
      ctx.staff.firstName.toLowerCase() === ctx.patient.firstName.toLowerCase() &&
      ctx.staff.lastName.toLowerCase() === ctx.patient.lastName.toLowerCase();
    return {
      rule: "self_access",
      fired,
      details: fired
        ? `Staff member ${ctx.staff.firstName} ${ctx.staff.lastName} accessed their own record`
        : undefined,
    };
  },
};
