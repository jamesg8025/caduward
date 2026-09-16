import { describe, expect, it } from "vitest";
import {
  DEFAULT_GENERATOR_CONFIG,
  accessTypeSchema,
  anomalyTypeSchema,
  departmentSchema,
  generatorConfigSchema,
  staffRoleSchema,
} from "./schemas.js";

describe("anomalyTypeSchema", () => {
  it("accepts valid anomaly types", () => {
    expect(anomalyTypeSchema.parse("no_encounter")).toBe("no_encounter");
    expect(anomalyTypeSchema.parse("off_shift")).toBe("off_shift");
    expect(anomalyTypeSchema.parse("dormant_reactivation")).toBe("dormant_reactivation");
  });

  it("rejects invalid anomaly types", () => {
    expect(() => anomalyTypeSchema.parse("fake_type")).toThrow();
  });
});

describe("accessTypeSchema", () => {
  it("accepts view, edit, print", () => {
    expect(accessTypeSchema.parse("view")).toBe("view");
    expect(accessTypeSchema.parse("edit")).toBe("edit");
    expect(accessTypeSchema.parse("print")).toBe("print");
  });

  it("rejects invalid access types", () => {
    expect(() => accessTypeSchema.parse("delete")).toThrow();
  });
});

describe("staffRoleSchema", () => {
  it("accepts valid roles", () => {
    expect(staffRoleSchema.parse("nurse")).toBe("nurse");
    expect(staffRoleSchema.parse("physician")).toBe("physician");
  });
});

describe("departmentSchema", () => {
  it("accepts valid departments", () => {
    expect(departmentSchema.parse("Emergency")).toBe("Emergency");
    expect(departmentSchema.parse("Cardiology")).toBe("Cardiology");
  });
});

describe("generatorConfigSchema", () => {
  it("parses the default config", () => {
    const result = generatorConfigSchema.parse(DEFAULT_GENERATOR_CONFIG);
    expect(result.totalEvents).toBe(100_000);
    expect(result.anomalyRate).toBe(0.015);
    expect(result.seed).toBe(42);
  });

  it("applies defaults for optional fields", () => {
    const minimal = {
      totalEvents: 1000,
      anomalyRate: 0.01,
      anomalyMix: {
        no_encounter: 0.5,
        off_shift: 0.5,
      },
      seed: 1,
    };
    const result = generatorConfigSchema.parse(minimal);
    expect(result.staffCount).toBe(200);
    expect(result.timeWindowDays).toBe(30);
  });

  it("rejects anomalyMix that does not sum to 1", () => {
    const bad = {
      ...DEFAULT_GENERATOR_CONFIG,
      anomalyMix: { no_encounter: 0.5, off_shift: 0.1 },
    };
    expect(() => generatorConfigSchema.parse(bad)).toThrow("sum to 1");
  });

  it("rejects negative anomalyRate", () => {
    const bad = { ...DEFAULT_GENERATOR_CONFIG, anomalyRate: -0.1 };
    expect(() => generatorConfigSchema.parse(bad)).toThrow();
  });

  it("rejects anomalyRate above 1", () => {
    const bad = { ...DEFAULT_GENERATOR_CONFIG, anomalyRate: 1.5 };
    expect(() => generatorConfigSchema.parse(bad)).toThrow();
  });
});
