import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const connectionString =
  process.env.CADUWARD_DATABASE_URL ??
  "postgresql://caduward:caduward@localhost:5432/caduward";

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

export * from "./schema.js";
