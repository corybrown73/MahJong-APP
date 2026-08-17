/**
 * Shanten for Filipino mahjong — how many tiles away from a winning hand.
 *
 * Published shanten algorithms assume the Japanese 14-tile, four-sets-plus-pair
 * hand. This variant is 17 tiles, five sets plus a pair, with a seven-pairs
 * alternative and optional wildcards, so it is derived directly here rather
 * than borrowed.
 *
 *   shanten(hand) = min(shantenStandard(hand), shantenSietePares(hand))
 *
 * -1 means the hand is already complete.
 */

import {
  isWinningHand,
  toCounts,
  type Counts,
  type Face,
  type Meld,
  type Tile,
} from '@bahay/engine';

export const SETS_NEEDED = 5;

export type ShantenInput = {
  concealed: Tile[];
  melds: Meld[];
  joker: Face | null;
};

const cache = new Map<string, number>();

function key(counts: Counts, meldCount: number, jokers: number, kind: string): string {
  return `${kind}:${counts.join('')}:${meldCount}:${jokers}`;
}

function scoreBlocks(complete: number, partial: number, hasPair: boolean): number {
  const capped = Math.min(partial, SETS_NEEDED - complete);
  return 2 * (SETS_NEEDED - complete) - capped - (hasPair ? 1 : 0);
}

/**
 * A way a single suit's nine ranks can be carved up: some finished sets, some
 * partial sets (a pair waiting to be a pung, or two tiles of a run), and
 * possibly the eye.
 */
type SuitProfile = { complete: number; partial: number; pair: boolean };

/**
 * Suits never interact — a run cannot cross from bolá into kahoy — so each suit
 * is solved on its own and the three answers are combined. Solving one suit at
 * a time makes the memo key nine digits instead of twenty-seven, which is what
 * turns this from seconds per decision into microseconds.
 */
const suitCache = new Map<string, SuitProfile[]>();

function enumerateSuit(counts: number[], base: number): SuitProfile[] {
  const cacheKey = counts.slice(base, base + 9).join('');
  const hit = suitCache.get(cacheKey);
  if (hit) return hit;

  const found: SuitProfile[] = [];
  const seen = new Set<number>();

  const record = (complete: number, partial: number, pair: boolean) => {
    const signature = complete * 100 + partial * 10 + (pair ? 1 : 0);
    if (seen.has(signature)) return;
    seen.add(signature);
    found.push({ complete, partial, pair });
  };

  const rec = (offset: number, complete: number, partial: number, pair: boolean) => {
    if (offset >= 9) {
      record(complete, partial, pair);
      return;
    }
    const index = base + offset;
    if (counts[index] === 0) {
      rec(offset + 1, complete, partial, pair);
      return;
    }
    // Leave this tile as a floater.
    const held = counts[index];
    counts[index] = 0;
    rec(offset + 1, complete, partial, pair);
    counts[index] = held;

    if (counts[index] >= 3) {
      counts[index] -= 3;
      rec(offset, complete + 1, partial, pair);
      counts[index] += 3;
    }
    if (offset <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index]--;
      counts[index + 1]--;
      counts[index + 2]--;
      rec(offset, complete + 1, partial, pair);
      counts[index]++;
      counts[index + 1]++;
      counts[index + 2]++;
    }
    if (!pair && counts[index] >= 2) {
      counts[index] -= 2;
      rec(offset, complete, partial, true);
      counts[index] += 2;
    }
    if (complete + partial < SETS_NEEDED) {
      if (counts[index] >= 2) {
        counts[index] -= 2;
        rec(offset, complete, partial + 1, pair);
        counts[index] += 2;
      }
      if (offset <= 7 && counts[index + 1] > 0) {
        counts[index]--;
        counts[index + 1]--;
        rec(offset, complete, partial + 1, pair);
        counts[index]++;
        counts[index + 1]++;
      }
      if (offset <= 6 && counts[index + 2] > 0) {
        counts[index]--;
        counts[index + 2]--;
        rec(offset, complete, partial + 1, pair);
        counts[index]++;
        counts[index + 2]++;
      }
    }
  };

  rec(0, 0, 0, false);

  // Only keep profiles nothing else dominates: more sets, more partials and a
  // pair are all improvements, so a profile beaten on every axis is dead weight.
  const pruned = found.filter(
    (a) =>
      !found.some(
        (b) =>
          b !== a &&
          b.complete >= a.complete &&
          b.partial >= a.partial &&
          (b.pair ? 1 : 0) >= (a.pair ? 1 : 0) &&
          (b.complete > a.complete || b.partial > a.partial || (b.pair && !a.pair)),
      ),
  );

  if (suitCache.size > 50_000) suitCache.clear();
  suitCache.set(cacheKey, pruned);
  return pruned;
}

export function shantenStandard(input: ShantenInput): number {
  const { counts, jokers } = toCounts(input.concealed, input.joker);
  const meldCount = input.melds.length;
  const cacheKey = key(counts, meldCount, jokers, 'std');
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;

  const balls = enumerateSuit(counts, 0);
  const sticks = enumerateSuit(counts, 9);
  const chars = enumerateSuit(counts, 18);

  let raw = Infinity;
  for (const a of balls) {
    for (const b of sticks) {
      if (a.pair && b.pair) continue;
      for (const c of chars) {
        const pairs = (a.pair ? 1 : 0) + (b.pair ? 1 : 0) + (c.pair ? 1 : 0);
        if (pairs > 1) continue;
        const complete = Math.min(SETS_NEEDED, meldCount + a.complete + b.complete + c.complete);
        const partial = a.partial + b.partial + c.partial;
        raw = Math.min(raw, scoreBlocks(complete, partial, pairs === 1));
      }
    }
  }

  const result = Math.max(-1, raw - jokers);
  if (cache.size > 100_000) cache.clear();
  cache.set(cacheKey, result);
  return result;
}

/** Seven pairs plus one báhay. Only reachable while at most one meld is out. */
export function shantenSietePares(input: ShantenInput): number {
  if (input.melds.length > 1) return Infinity;
  if (input.melds.some((m) => m.type === 'kang')) return Infinity;
  const { counts, jokers } = toCounts(input.concealed, input.joker);
  const cacheKey = key(counts, input.melds.length, jokers, 'siete');
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;

  let pairs = 0;
  let singles = 0;
  for (let i = 0; i < 27; i++) {
    pairs += Math.floor(counts[i] / 2);
    singles += counts[i] % 2;
  }
  const pairsNeeded = 7;
  const usableJokers = Math.min(jokers, Math.min(singles, pairsNeeded - Math.min(pairs, pairsNeeded)));
  const result = Math.max(-1, pairsNeeded - 1 - Math.min(pairs, pairsNeeded) - usableJokers);
  cache.set(cacheKey, result);
  return result;
}

export function shanten(input: ShantenInput): number {
  const best = Math.min(shantenStandard(input), shantenSietePares(input));
  if (best >= 0) return best;

  // Both estimators are block counters, and a block count can read as complete
  // when the hand is not — eight pairs and a floater look like siete pares
  // until you go looking for the báhay. A claim of "already won" is the one
  // answer worth confirming against the exact detector.
  const won = isWinningHand({
    concealed: input.concealed,
    melds: input.melds,
    joker: input.joker,
    sieteParesRequiresConcealed: false,
  });
  return won ? -1 : 0;
}

/**
 * The faces that would reduce shanten if drawn — "tile acceptance". Also what
 * the player-facing hint system shows.
 */
export function acceptingFaces(input: ShantenInput): Face[] {
  const current = shanten(input);
  const out: Face[] = [];
  for (const suit of ['balls', 'sticks', 'chars'] as const) {
    for (let rank = 1; rank <= 9; rank++) {
      const probe: Tile = { kind: 'suited', suit, rank: rank as 1, id: `accept-${suit}-${rank}` };
      const next = shanten({ ...input, concealed: [...input.concealed, probe] });
      if (next < current) out.push({ suit, rank: rank as 1 });
    }
  }
  return out;
}
