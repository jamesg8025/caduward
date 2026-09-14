import { describe, it } from "vitest";

// Placeholder — real tests will be added in Phase 3 alongside the
// flag-explanation Zod schema and other shared types.
describe("@caduward/shared", () => {
  it("is a valid module", async () => {
    // Import succeeds without throwing.
    await import("./index.js");
  });
});
