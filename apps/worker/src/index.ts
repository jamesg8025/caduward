import { db } from "@caduward/db";
import { refreshRoleBaselines } from "./baselines/refresh.js";
import { runDetectionPass } from "./detect.js";

async function main() {
  console.log("CaduWard worker starting...");

  console.log("Refreshing role baselines...");
  const baselineResult = await refreshRoleBaselines(db);
  console.log(`  ${baselineResult.rolesUpdated} role/department baselines computed`);

  console.log("Running detection pass...");
  const result = await runDetectionPass(db);
  console.log("Detection pass complete:");
  console.log(`  Events processed: ${result.totalProcessed}`);
  console.log(`  Events flagged: ${result.totalFlagged}`);
  console.log("  Rule breakdown:", result.ruleBreakdown);

  process.exit(0);
}

main().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
