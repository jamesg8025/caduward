import { cosineSimilarity } from "../baselines/compute.js";
import type { RuleContext, RuleResult } from "./types.js";

export interface PatternDeviationContext extends RuleContext {
  featureVector: number[];
  baselineCentroid: number[] | null;
  similarityThreshold: number;
}

export function checkPatternDeviation(ctx: PatternDeviationContext): RuleResult & {
  similarityScore: number | null;
} {
  if (ctx.baselineCentroid === null) {
    return { rule: "pattern_deviation", fired: false, similarityScore: null };
  }

  const similarity = cosineSimilarity(ctx.featureVector, ctx.baselineCentroid);

  const fired = similarity < ctx.similarityThreshold;
  return {
    rule: "pattern_deviation",
    fired,
    similarityScore: similarity,
    details: fired
      ? `Cosine similarity ${similarity.toFixed(3)} below threshold ${ctx.similarityThreshold}`
      : undefined,
  };
}
