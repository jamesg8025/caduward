import { describe, expect, it } from "vitest";
import {
  ANOMALY_TYPES,
  anomalyTypeSchema,
  reviewStatusSchema,
  ruleResultSchema,
  severitySchema,
} from "./index.js";

describe("@caduward/shared", () => {
  it("is a valid module", async () => {
    await import("./index.js");
  });

  it("includes pattern_deviation in ANOMALY_TYPES", () => {
    expect(ANOMALY_TYPES).toContain("pattern_deviation");
  });

  describe("anomalyTypeSchema", () => {
    it("accepts all anomaly types including pattern_deviation", () => {
      for (const t of ANOMALY_TYPES) {
        expect(anomalyTypeSchema.parse(t)).toBe(t);
      }
    });

    it("rejects unknown values", () => {
      expect(() => anomalyTypeSchema.parse("unknown")).toThrow();
    });
  });

  describe("reviewStatusSchema", () => {
    it("accepts valid statuses", () => {
      for (const s of ["open", "reviewed", "escalated", "dismissed"]) {
        expect(reviewStatusSchema.parse(s)).toBe(s);
      }
    });

    it("rejects unknown values", () => {
      expect(() => reviewStatusSchema.parse("closed")).toThrow();
    });
  });

  describe("severitySchema", () => {
    it("accepts valid severity levels", () => {
      for (const s of ["low", "medium", "high", "critical"]) {
        expect(severitySchema.parse(s)).toBe(s);
      }
    });

    it("rejects unknown values", () => {
      expect(() => severitySchema.parse("extreme")).toThrow();
    });
  });

  describe("ruleResultSchema", () => {
    it("accepts a fired rule with details", () => {
      const result = ruleResultSchema.parse({
        rule: "off_shift",
        fired: true,
        details: "Access at 03:00, shift is 08:00-16:00",
      });
      expect(result.rule).toBe("off_shift");
      expect(result.fired).toBe(true);
      expect(result.details).toBeDefined();
    });

    it("accepts a non-fired rule without details", () => {
      const result = ruleResultSchema.parse({
        rule: "no_encounter",
        fired: false,
      });
      expect(result.fired).toBe(false);
      expect(result.details).toBeUndefined();
    });

    it("rejects invalid rule names", () => {
      expect(() => ruleResultSchema.parse({ rule: "invalid", fired: true })).toThrow();
    });
  });
});
