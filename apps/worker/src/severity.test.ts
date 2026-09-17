import { describe, expect, it } from "vitest";
import { computeSeverity } from "./severity.js";

describe("computeSeverity", () => {
  it("returns critical for 3+ rules fired", () => {
    expect(computeSeverity(["no_encounter", "off_shift", "relationship_snoop"])).toBe("critical");
  });

  it("returns critical for self_access combined with any other rule", () => {
    expect(computeSeverity(["self_access", "off_shift"])).toBe("critical");
  });

  it("returns high for 2 rules fired", () => {
    expect(computeSeverity(["no_encounter", "off_shift"])).toBe("high");
  });

  it("returns high for self_access alone", () => {
    expect(computeSeverity(["self_access"])).toBe("high");
  });

  it("returns high for vip_access alone", () => {
    expect(computeSeverity(["vip_access"])).toBe("high");
  });

  it("returns medium for off_shift alone", () => {
    expect(computeSeverity(["off_shift"])).toBe("medium");
  });

  it("returns medium for relationship_snoop alone", () => {
    expect(computeSeverity(["relationship_snoop"])).toBe("medium");
  });

  it("returns medium for pattern_deviation alone", () => {
    expect(computeSeverity(["pattern_deviation"])).toBe("medium");
  });

  it("returns low for no_encounter alone", () => {
    expect(computeSeverity(["no_encounter"])).toBe("low");
  });

  it("returns low for dormant_reactivation alone", () => {
    expect(computeSeverity(["dormant_reactivation"])).toBe("low");
  });

  it("returns low for empty rules array", () => {
    expect(computeSeverity([])).toBe("low");
  });
});
