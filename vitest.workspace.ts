import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "apps/worker/vitest.config.ts",
  "packages/db/vitest.config.ts",
  "packages/synthetic-data/vitest.config.ts",
  "packages/shared/vitest.config.ts",
]);
