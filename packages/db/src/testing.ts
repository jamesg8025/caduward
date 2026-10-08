import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DEFAULT_DATABASE_URL } from "./config";
import * as schema from "./schema";

/** Dedicated integration-test database on the compose Postgres instance. */
export const DEFAULT_TEST_DATABASE_URL =
  "postgresql://caduward:caduward@localhost:5433/caduward_test";

type Env = Record<string, string | undefined>;

function databaseKey(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || "5432"}/${parsed.pathname.slice(1)}`;
}

export function databaseName(url: string): string {
  return new URL(url).pathname.slice(1);
}

/**
 * Guard against integration tests truncating a real database: the target must be
 * named *_test and must not be the configured dev database.
 */
export function assertSafeTestDatabaseUrl(testUrl: string, devUrl: string): void {
  const name = databaseName(testUrl);
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${name}": test database names must end in "_test".`,
    );
  }
  if (databaseKey(testUrl) === databaseKey(devUrl)) {
    throw new Error(
      `Refusing to run integration tests against the dev database "${name}" (CADUWARD_DATABASE_URL).`,
    );
  }
}

/** The integration-test database URL, validated by assertSafeTestDatabaseUrl. */
export function resolveTestDatabaseUrl(env: Env = process.env): string {
  const testUrl = env.CADUWARD_TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  assertSafeTestDatabaseUrl(testUrl, env.CADUWARD_DATABASE_URL ?? DEFAULT_DATABASE_URL);
  return testUrl;
}

/** A schema-typed client on the test database. Call `client.end()` in afterAll. */
export function createTestDb() {
  // Silence NOTICEs such as "truncate cascades to table ..." from test cleanup
  const client = postgres(resolveTestDatabaseUrl(), { onnotice: () => {} });
  return { db: drizzle(client, { schema }), client };
}
