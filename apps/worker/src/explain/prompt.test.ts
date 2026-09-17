import { describe, expect, it } from "vitest";
import { type FlagContext, buildPrompt } from "./prompt.js";

function makeFlagContext(overrides?: Partial<FlagContext>): FlagContext {
  return {
    flagId: "flag-1",
    triggeredRules: ["off_shift"],
    severity: "medium",
    similarityScore: null,
    event: {
      timestamp: new Date("2025-06-15T03:30:00Z"),
      accessType: "view",
    },
    staff: {
      firstName: "Jane",
      lastName: "Doe",
      role: "nurse",
      department: "Emergency",
      shiftStart: "07:00:00",
      shiftEnd: "15:00:00",
    },
    patient: {
      firstName: "John",
      lastName: "Smith",
      isVip: false,
    },
    ...overrides,
  };
}

describe("buildPrompt", () => {
  it("includes staff and patient details in the prompt", () => {
    const prompt = buildPrompt(makeFlagContext());

    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("nurse");
    expect(prompt).toContain("Emergency");
    expect(prompt).toContain("John Smith");
    expect(prompt).toContain("07:00:00");
    expect(prompt).toContain("15:00:00");
  });

  it("includes triggered rule descriptions", () => {
    const prompt = buildPrompt(makeFlagContext({ triggeredRules: ["off_shift", "no_encounter"] }));

    expect(prompt).toContain("off_shift");
    expect(prompt).toContain("outside the staff member's assigned shift window");
    expect(prompt).toContain("no_encounter");
    expect(prompt).toContain("no linked scheduled encounter");
  });

  it("marks VIP patients", () => {
    const prompt = buildPrompt(
      makeFlagContext({
        patient: { firstName: "John", lastName: "Smith", isVip: true },
      }),
    );

    expect(prompt).toContain("[VIP]");
  });

  it("does not include VIP marker for non-VIP patients", () => {
    const prompt = buildPrompt(makeFlagContext());

    expect(prompt).not.toContain("[VIP]");
  });

  it("includes similarity score when present", () => {
    const prompt = buildPrompt(makeFlagContext({ similarityScore: 0.8523 }));

    expect(prompt).toContain("0.8523");
    expect(prompt).toContain("cosine distance");
  });

  it("omits similarity note when score is null", () => {
    const prompt = buildPrompt(makeFlagContext({ similarityScore: null }));

    expect(prompt).not.toContain("cosine distance");
  });

  it("includes JSON response instructions", () => {
    const prompt = buildPrompt(makeFlagContext());

    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('"contributing_factors"');
    expect(prompt).toContain('"recommended_action"');
    expect(prompt).toContain("Respond ONLY with the JSON object");
  });

  it("handles unknown rules gracefully", () => {
    const prompt = buildPrompt(makeFlagContext({ triggeredRules: ["unknown_rule"] }));

    expect(prompt).toContain("unknown_rule");
    expect(prompt).toContain("Unknown rule");
  });
});
