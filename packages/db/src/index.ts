import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DEFAULT_DATABASE_URL } from "./config";
import * as schema from "./schema";

const connectionString = process.env.CADUWARD_DATABASE_URL ?? DEFAULT_DATABASE_URL;

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

/** Schema-typed Drizzle client. Use this type for functions that take a db handle. */
export type Database = typeof db;

export * from "./schema";

// Re-export drizzle query utilities so consumers use the same version
export { eq, and, or, desc, asc, sql, type SQL } from "drizzle-orm";
