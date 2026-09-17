import { db } from "@caduward/db";
import { refreshRoleBaselines } from "./baselines/refresh.js";
import { runDetectionPass } from "./detect.js";
import { runExplanationPass } from "./explain/explain.js";
import { createProvider } from "./explain/providers.js";

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

  console.log("Running explanation pass...");
  const provider = createProvider();
  const explainResult = await runExplanationPass(db, provider);
  console.log("Explanation pass complete:");
  console.log(`  Flags processed: ${explainResult.totalProcessed}`);
  console.log(`  Explanations generated: ${explainResult.totalExplained}`);
  console.log(`  Failed: ${explainResult.totalFailed}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
