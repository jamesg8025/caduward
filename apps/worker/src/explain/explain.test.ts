import { describe, expect, it, vi } from "vitest";
import { generateExplanation, parseExplanationResponse } from "./explain.js";
import type { FlagContext } from "./prompt.js";
import type { ExplanationProvider } from "./providers.js";

describe("parseExplanationResponse", () => {
  it("parses valid JSON", () => {
    const raw = JSON.stringify({
      summary: "Access occurred outside shift hours.",
      contributing_factors: ["Off-shift access at 3:30 AM", "No linked encounter"],
      recommended_action: "Review with the staff member's supervisor.",
    });

    const result = parseExplanationResponse(raw);

    expect(result.summary).toBe("Access occurred outside shift hours.");
    expect(result.contributing_factors).toHaveLength(2);
    expect(result.recommended_action).toContain("supervisor");
  });

  it("strips markdown code fences", () => {
    const raw = `\`\`\`json
{
  "summary": "Flagged access.",
  "contributing_factors": ["Factor one"],
  "recommended_action": "Investigate."
}
\`\`\``;

    const result = parseExplanationResponse(raw);
    expect(result.summary).toBe("Flagged access.");
  });

  it("strips code fences without json label", () => {
    const raw = `\`\`\`
{
  "summary": "Flagged access.",
  "contributing_factors": ["Factor one"],
  "recommended_action": "Investigate."
}
\`\`\``;

    const result = parseExplanationResponse(raw);
    expect(result.summary).toBe("Flagged access.");
  });

  it("rejects missing summary", () => {
    const raw = JSON.stringify({
      contributing_factors: ["Factor"],
      recommended_action: "Do something.",
    });

    expect(() => parseExplanationResponse(raw)).toThrow();
  });

  it("rejects empty contributing_factors array", () => {
    const raw = JSON.stringify({
      summary: "Something happened.",
      contributing_factors: [],
      recommended_action: "Do something.",
    });

    expect(() => parseExplanationResponse(raw)).toThrow();
  });

  it("rejects invalid JSON", () => {
    expect(() => parseExplanationResponse("not json at all")).toThrow();
  });

  it("rejects empty summary", () => {
    const raw = JSON.stringify({
      summary: "",
      contributing_factors: ["Factor"],
      recommended_action: "Do something.",
    });

    expect(() => parseExplanationResponse(raw)).toThrow();
  });
});

describe("generateExplanation", () => {
  const validResponse = JSON.stringify({
    summary: "Nurse accessed record outside scheduled shift.",
    contributing_factors: ["Access at 3:30 AM", "Shift ends at 3:00 PM"],
    recommended_action: "Verify with department supervisor whether overtime was authorized.",
  });

  const flagContext: FlagContext = {
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
  };

  it("returns parsed explanation on valid response", async () => {
    const provider: ExplanationProvider = {
      generate: vi.fn().mockResolvedValue(validResponse),
    };

    const result = await generateExplanation(provider, flagContext);

    expect(result.explanation.summary).toContain("outside scheduled shift");
    expect(result.rawResponse).toBe(validResponse);
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });

  it("retries on validation failure and succeeds", async () => {
    const provider: ExplanationProvider = {
      generate: vi.fn().mockResolvedValueOnce("invalid json").mockResolvedValueOnce(validResponse),
    };

    const result = await generateExplanation(provider, flagContext, 1);

    expect(result.explanation.summary).toContain("outside scheduled shift");
    expect(provider.generate).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    const provider: ExplanationProvider = {
      generate: vi.fn().mockResolvedValue("not json"),
    };

    await expect(generateExplanation(provider, flagContext, 1)).rejects.toThrow(
      "Explanation validation failed after 2 attempts",
    );
    expect(provider.generate).toHaveBeenCalledTimes(2);
  });

  it("propagates provider errors without retry", async () => {
    const provider: ExplanationProvider = {
      generate: vi.fn().mockRejectedValue(new Error("API rate limited")),
    };

    await expect(generateExplanation(provider, flagContext, 2)).rejects.toThrow("API rate limited");
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });
});
