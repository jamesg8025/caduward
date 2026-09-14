import { describe, it } from "vitest";

// Placeholder — real tests will be added in Phase 2 alongside each detection
// rule (one test file per rule, co-located with the rule implementation).
//
// Pattern for future tests:
//   describe("offHoursRule", () => {
//     it("flags access outside scheduled hours", () => { ... })
//     it("does not flag access within scheduled hours", () => { ... })
//   })
describe("@caduward/worker", () => {
  it("is a valid module", async () => {
    await import("./index.js");
  });
});
