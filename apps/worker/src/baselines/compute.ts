/** Compute the element-wise mean of a set of vectors (centroid). */
export function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error("Cannot compute centroid of zero vectors");
  }

  const dimensions = vectors[0].length;
  const sum = new Array<number>(dimensions).fill(0);

  for (const v of vectors) {
    for (let i = 0; i < dimensions; i++) {
      sum[i] += v[i];
    }
  }

  return sum.map((s) => s / vectors.length);
}

/** Compute cosine similarity between two vectors. Returns a value in [-1, 1]. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}
