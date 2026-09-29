import type { DetectionRule } from "./types.js";

export const relationshipSnoopRule: DetectionRule = {
  name: "relationship_snoop",
  check(ctx) {
    const matches: string[] = [];

    if (ctx.staff.lastName.toLowerCase() === ctx.patient.lastName.toLowerCase()) {
      matches.push("shared last name");
    }

    if (ctx.staff.address.toLowerCase() === ctx.patient.address.toLowerCase()) {
      matches.push("shared address");
    }

    if (ctx.patient.emergencyContact?.toLowerCase().includes(ctx.staff.lastName.toLowerCase())) {
      matches.push("staff last name appears in patient emergency contact");
    }

    // Require a relationship signal, no department-level encounter, AND no directly
    // linked encounter — coincidental name collisions with legitimate care are not suspicious.
    const fired =
      matches.length > 0 &&
      !ctx.hasEncounterForStaffAndPatient &&
      ctx.event.linkedEncounterId === null;
    return {
      rule: "relationship_snoop",
      fired,
      details: fired ? `Matching attributes: ${matches.join(", ")}` : undefined,
    };
  },
};
