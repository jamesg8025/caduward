import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "synthetic-data",
    environment: "node",
    // Creates and migrates the dedicated test database; integration tests never touch the dev DB
    globalSetup: ["@caduward/db/test-global-setup"],
  },
});
