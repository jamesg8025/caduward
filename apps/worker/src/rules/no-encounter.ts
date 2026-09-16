import type { DetectionRule } from "./types.js";

export const noEncounterRule: DetectionRule = {
  name: "no_encounter",
  check(ctx) {
    const fired = ctx.event.linkedEncounterId === null;
    return {
      rule: "no_encounter",
      fired,
      details: fired ? "Access event has no linked encounter (break-glass)" : undefined,
    };
  },
};
