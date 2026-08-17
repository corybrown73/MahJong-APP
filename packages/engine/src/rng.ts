/**
 * Deterministic RNG. Given a seed, a game must replay identically, so the
 * engine never touches Math.random.
 */

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export type Rng = {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** A single die, 1-6. */
  die(): number;
};

export function createRng(seed: string): Rng {
  let a = hashSeed(seed);
  const next = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    die: () => 1 + Math.floor(next() * 6),
  };
}

/** Fisher-Yates, in place, using the supplied RNG. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}
