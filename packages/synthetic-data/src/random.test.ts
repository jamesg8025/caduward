import { describe, expect, it } from "vitest";
import { SeededRandom } from "./random.js";

describe("SeededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);

    const seqA = Array.from({ length: 10 }, () => a.float());
    const seqB = Array.from({ length: 10 }, () => b.float());

    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(99);

    const seqA = Array.from({ length: 5 }, () => a.float());
    const seqB = Array.from({ length: 5 }, () => b.float());

    expect(seqA).not.toEqual(seqB);
  });

  it("int returns values within the specified range", () => {
    const rng = new SeededRandom(1);
    const values = Array.from({ length: 100 }, () => rng.int(5, 10));

    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it("pick returns elements from the array", () => {
    const rng = new SeededRandom(1);
    const items = ["a", "b", "c"] as const;
    const picks = Array.from({ length: 20 }, () => rng.pick(items));

    for (const p of picks) {
      expect(items).toContain(p);
    }
  });

  it("shuffle returns all elements in a different order", () => {
    const rng = new SeededRandom(1);
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = rng.shuffle(original);

    expect(shuffled).toHaveLength(original.length);
    expect(new Set(shuffled)).toEqual(new Set(original));
    // With 10 elements, extremely unlikely to be identical
    expect(shuffled).not.toEqual(original);
  });

  it("shuffle does not mutate the original array", () => {
    const rng = new SeededRandom(1);
    const original = [1, 2, 3];
    const copy = [...original];
    rng.shuffle(original);

    expect(original).toEqual(copy);
  });

  it("weightedPick respects weights", () => {
    const rng = new SeededRandom(42);
    const weights = { heavy: 0.9, light: 0.1 };
    const picks = Array.from({ length: 1000 }, () => rng.weightedPick(weights));

    const heavyCount = picks.filter((p) => p === "heavy").length;
    // Should be roughly 900 ± some variance
    expect(heavyCount).toBeGreaterThan(800);
    expect(heavyCount).toBeLessThan(980);
  });

  it("chance returns boolean based on probability", () => {
    const rng = new SeededRandom(42);
    const results = Array.from({ length: 1000 }, () => rng.chance(0.5));
    const trueCount = results.filter(Boolean).length;

    expect(trueCount).toBeGreaterThan(400);
    expect(trueCount).toBeLessThan(600);
  });

  it("dateBetween returns dates within range", () => {
    const rng = new SeededRandom(42);
    const start = new Date("2025-01-01");
    const end = new Date("2025-12-31");
    const dates = Array.from({ length: 50 }, () => rng.dateBetween(start, end));

    for (const d of dates) {
      expect(d.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(d.getTime()).toBeLessThanOrEqual(end.getTime());
    }
  });
});
