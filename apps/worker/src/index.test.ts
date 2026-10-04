import { describe, expect, it } from "vitest";
import { DETECTION_RULES, runRules } from "./rules/index.js";

describe("@caduward/worker", () => {
  it("exports all expected detection rules", () => {
    const ruleNames = DETECTION_RULES.map((r) => r.name);
    expect(ruleNames).toContain("no_encounter");
    expect(ruleNames).toContain("off_shift");
    expect(ruleNames).toContain("relationship_snoop");
    expect(ruleNames).toContain("vip_access");
    expect(ruleNames).toContain("self_access");
    expect(ruleNames).toContain("dormant_reactivation");
    expect(DETECTION_RULES).toHaveLength(6);
  });

  it("runRules returns only fired rules", () => {
    const results = runRules({
      event: {
        id: "e1",
        staffId: "s1",
        patientId: "p1",
        timestamp: new Date("2025-01-15T10:00:00Z"),
        accessType: "view",
        linkedEncounterId: "enc-1",
      },
      staff: {
        id: "s1",
        firstName: "Alice",
        lastName: "Smith",
        role: "nurse",
        department: "Emergency",
        shiftStart: "08:00",
        shiftEnd: "16:00",
        address: "123 Main St",
        isActive: true,
        patientId: null,
      },
      patient: {
        id: "p1",
        firstName: "Bob",
        lastName: "Jones",
        address: "456 Oak Ave",
        emergencyContact: null,
        isVip: false,
      },
      hasEncounterForStaffAndPatient: true,
    });
    // Normal event: no rules should fire
    expect(results).toHaveLength(0);
  });
});
