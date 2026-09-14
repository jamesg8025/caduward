import { describe, it } from "vitest";

// Placeholder — real integration tests (against the compose Postgres instance)
// will be added in Phase 1 once the schema and migrations exist.
//
// Pattern for future tests:
//   beforeEach(() => sql`TRUNCATE <table> CASCADE`)
//   it("inserts and retrieves a row", async () => { ... })
describe("@caduward/db", () => {
  it("exports a db client", async () => {
    const mod = await import("./index.js");
    if (!("db" in mod)) throw new Error("db export missing");
  });
});
