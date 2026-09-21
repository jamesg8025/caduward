import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.CADUWARD_DATABASE_URL ?? "postgresql://caduward:caduward@localhost:5433/caduward";

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

export * from "./schema";

// Re-export drizzle query utilities so consumers use the same version
export { eq, and, or, desc, asc, sql, type SQL } from "drizzle-orm";
