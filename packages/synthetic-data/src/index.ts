import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@caduward/db";
import { loadConfig } from "./config.js";
import { transformBundle } from "./fhir/transform.js";
import { fhirBundleSchema } from "./fhir/types.js";
import { generateAccessEvents } from "./generators/access-events.js";
import { generateStaff } from "./generators/staff.js";
import { SeededRandom } from "./random.js";
import { seedDatabase } from "./seed.js";

async function main() {
  console.log("CaduWard synthetic-data generator\n");

  // 1. Load config
  const config = loadConfig();
  console.log(
    `Config: ${config.totalEvents} events, ${config.anomalyRate * 100}% anomaly rate, seed=${config.seed}`,
  );

  // 2. Read and transform FHIR bundle
  const fixturePath = join(import.meta.dirname, "..", "fixtures", "synthea-bundle.json");
  const raw = JSON.parse(readFileSync(fixturePath, "utf-8"));
  const bundle = fhirBundleSchema.parse(raw);

  const rng = new SeededRandom(config.seed);
  const { patients, encounters } = transformBundle(bundle);
  console.log(`FHIR transform: ${patients.length} patients, ${encounters.length} encounters`);

  // 3. Generate staff
  const staffMembers = generateStaff(patients, { staffCount: config.staffCount }, rng);
  const activeCount = staffMembers.filter((s) => s.isActive).length;
  const dormantCount = staffMembers.length - activeCount;
  console.log(
    `Staff: ${staffMembers.length} total (${activeCount} active, ${dormantCount} dormant)`,
  );

  // 4. Generate access events with anomaly injection
  const accessEventsList = generateAccessEvents(patients, encounters, staffMembers, config, rng);
  const anomalyCount = accessEventsList.filter((e) => e.isSeededAnomaly).length;
  console.log(`Access events: ${accessEventsList.length} total (${anomalyCount} seeded anomalies)`);

  // Print anomaly breakdown
  const anomalyBreakdown = new Map<string, number>();
  for (const e of accessEventsList) {
    if (e.seededAnomalyType) {
      anomalyBreakdown.set(
        e.seededAnomalyType,
        (anomalyBreakdown.get(e.seededAnomalyType) ?? 0) + 1,
      );
    }
  }
  for (const [type, count] of anomalyBreakdown) {
    console.log(`  ${type}: ${count}`);
  }

  // 5. Seed database
  console.log("\nSeeding database...");
  await seedDatabase(
    { patients, encounters, staff: staffMembers, accessEvents: accessEventsList },
    db,
  );
  console.log("Done. Database seeded successfully.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
