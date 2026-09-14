import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { transformBundle } from "./fhir/transform.js";
import { generateAccessEvents } from "./generators/access-events.js";
import { generateStaff } from "./generators/staff.js";
import { SeededRandom } from "./random.js";

describe("@caduward/synthetic-data", () => {
  it("exports all pipeline components", () => {
    expect(loadConfig).toBeTypeOf("function");
    expect(transformBundle).toBeTypeOf("function");
    expect(generateStaff).toBeTypeOf("function");
    expect(generateAccessEvents).toBeTypeOf("function");
    expect(SeededRandom).toBeTypeOf("function");
  });
});
