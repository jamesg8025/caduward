import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { databaseName, resolveTestDatabaseUrl } from "./testing";

/**
 * Vitest globalSetup for packages with DB integration tests: creates the test
 * database if it doesn't exist and applies all migrations to it.
 */
export default async function setup(): Promise<void> {
  const testUrl = resolveTestDatabaseUrl();
  const name = databaseName(testUrl);

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { onnotice: () => {} });
  try {
    const existing = await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (existing.length === 0) {
      await admin`CREATE DATABASE ${admin(name)}`;
    }
  } catch (err) {
    // Another project's setup may have created it concurrently (duplicate_database)
    if ((err as { code?: string }).code !== "42P04") throw err;
  } finally {
    await admin.end();
  }

  const client = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: join(__dirname, "..", "drizzle") });
  } finally {
    await client.end();
  }
}
