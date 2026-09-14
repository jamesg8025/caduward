import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.CADUWARD_DATABASE_URL ??
      "postgresql://caduward:caduward@localhost:5432/caduward",
  },
});
