import seedrandom from "seedrandom";

export class SeededRandom {
  private rng: () => number;

  constructor(seed: number | string) {
    this.rng = seedrandom(String(seed));
  }

  /** Returns a float in [0, 1) */
  float(): number {
    return this.rng();
  }

  /** Returns an integer in [min, max] (inclusive) */
  int(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  /** Picks a random element from the array */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rng() * arr.length)];
  }

  /** Returns a shuffled copy of the array (Fisher-Yates) */
  shuffle<T>(arr: readonly T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /** Picks from weighted options. weights maps keys to relative probabilities. */
  weightedPick<K extends string>(weights: Record<K, number>): K {
    const entries = Object.entries(weights) as [K, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.rng() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  /** Returns true with the given probability (0 to 1) */
  chance(probability: number): boolean {
    return this.rng() < probability;
  }

  /** Picks a random date between start and end */
  dateBetween(start: Date, end: Date): Date {
    const startMs = start.getTime();
    const endMs = end.getTime();
    return new Date(startMs + this.rng() * (endMs - startMs));
  }
}
