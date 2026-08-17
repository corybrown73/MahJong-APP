/**
 * Meld detection and win detection.
 *
 * The winning shape in Filipino mahjong is 17 tiles: five *báhay* (sets) plus
 * one *eye* (pair) — with an alternative shape, *siete pares*: seven pairs plus
 * one báhay. Both must be checked.
 *
 * Hands are searched as a 27-slot count vector (3 suits × 9 ranks). Jokers are
 * pulled out of the vector and carried as a scalar, because a joker is a
 * wildcard for any suited tile rather than a tile of its own.
 */

import { faceFromIndex, faceIndex, isSuited, SUITS } from './tiles.js';
import type { Face, Meld, Rank, Suit, Tile } from './types.js';

export type Counts = number[]; // length 27

export type WinSet = {
  type: 'pung' | 'chow' | 'kang';
  /** null when the set is made entirely of jokers and so has no fixed face. */
  suit: Suit | null;
  /** For a chow, the lowest rank of the run. */
  rank: Rank | null;
  jokers: number;
  exposed: boolean;
};

export type WinEye = { face: Face | null; jokers: number };

export type WinShape = {
  kind: 'standard' | 'siete';
  sets: WinSet[];
  /** Seven pairs, for the *siete pares* shape. Empty for the standard shape. */
  pairs: (Face | null)[];
  eye: WinEye | null;
};

export function emptyCounts(): Counts {
  return new Array(27).fill(0);
}

/**
 * Split tiles into a count vector plus a joker count. Flowers are never part of
 * a hand and are ignored here.
 */
export function toCounts(tiles: Tile[], joker: Face | null): { counts: Counts; jokers: number } {
  const counts = emptyCounts();
  let jokers = 0;
  for (const tile of tiles) {
    if (!isSuited(tile)) continue;
    if (joker && tile.suit === joker.suit && tile.rank === joker.rank) {
      jokers++;
      continue;
    }
    counts[faceIndex(tile.suit, tile.rank)]++;
  }
  return { counts, jokers };
}

export function countsKey(counts: Counts, meldsNeeded: number, needEye: boolean, jokers: number): string {
  return `${counts.join('')}|${meldsNeeded}|${needEye ? 1 : 0}|${jokers}`;
}

function firstTile(counts: Counts): number {
  for (let i = 0; i < 27; i++) if (counts[i] > 0) return i;
  return -1;
}

const winMemo = new Map<string, boolean>();

/**
 * Can this count vector be partitioned into exactly `meldsNeeded` sets plus,
 * if `needEye`, one pair — consuming every tile and every joker?
 */
export function canFormSets(
  counts: Counts,
  meldsNeeded: number,
  needEye: boolean,
  jokers: number,
): boolean {
  if (meldsNeeded < 0 || jokers < 0) return false;
  const key = countsKey(counts, meldsNeeded, needEye, jokers);
  const memo = winMemo.get(key);
  if (memo !== undefined) return memo;

  const result = searchWin(counts, meldsNeeded, needEye, jokers);
  if (winMemo.size > 200_000) winMemo.clear();
  winMemo.set(key, result);
  return result;
}

function searchWin(counts: Counts, meldsNeeded: number, needEye: boolean, jokers: number): boolean {
  const i = firstTile(counts);
  if (i === -1) {
    // Only jokers remain: they must exactly fill what is still owed.
    return jokers === meldsNeeded * 3 + (needEye ? 2 : 0);
  }
  if (meldsNeeded === 0 && !needEye) return false; // real tiles left over

  const suitBase = Math.floor(i / 9) * 9;
  const rankOffset = i - suitBase;

  if (meldsNeeded > 0) {
    // Pung: use as many real copies as available, filling the rest with jokers.
    for (let real = Math.min(3, counts[i]); real >= 1; real--) {
      const need = 3 - real;
      if (need > jokers) continue;
      counts[i] -= real;
      const ok = canFormSets(counts, meldsNeeded - 1, needEye, jokers - need);
      counts[i] += real;
      if (ok) return true;
    }

    // Chow: i is the lowest remaining tile, so it is always the run's first
    // tile and is always real; the other two may be real or filled by a joker.
    if (rankOffset <= 6) {
      const j = i + 1;
      const k = i + 2;
      for (const useJokerJ of [false, true]) {
        if (!useJokerJ && counts[j] === 0) continue;
        for (const useJokerK of [false, true]) {
          if (!useJokerK && counts[k] === 0) continue;
          const need = (useJokerJ ? 1 : 0) + (useJokerK ? 1 : 0);
          if (need > jokers) continue;
          counts[i]--;
          if (!useJokerJ) counts[j]--;
          if (!useJokerK) counts[k]--;
          const ok = canFormSets(counts, meldsNeeded - 1, needEye, jokers - need);
          counts[i]++;
          if (!useJokerJ) counts[j]++;
          if (!useJokerK) counts[k]++;
          if (ok) return true;
        }
      }
    }
  }

  if (needEye) {
    if (counts[i] >= 2) {
      counts[i] -= 2;
      const ok = canFormSets(counts, meldsNeeded, false, jokers);
      counts[i] += 2;
      if (ok) return true;
    }
    if (jokers >= 1) {
      counts[i] -= 1;
      const ok = canFormSets(counts, meldsNeeded, false, jokers - 1);
      counts[i] += 1;
      if (ok) return true;
    }
  }

  return false;
}

/** Every distinct way the concealed pool can be partitioned. Capped, for sanity. */
const DECOMPOSITION_CAP = 400;

export function decompose(
  counts: Counts,
  meldsNeeded: number,
  jokers: number,
): { sets: WinSet[]; eye: WinEye }[] {
  const out: { sets: WinSet[]; eye: WinEye }[] = [];
  const seen = new Set<string>();
  const sets: WinSet[] = [];

  const emit = (eye: WinEye) => {
    const key =
      sets
        .map((s) => `${s.type}${s.suit ?? '*'}${s.rank ?? '*'}j${s.jokers}`)
        .sort()
        .join(',') + `|eye:${eye.face ? `${eye.face.suit}${eye.face.rank}` : '*'}j${eye.jokers}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ sets: sets.map((s) => ({ ...s })), eye: { ...eye } });
  };

  const rec = (meldsLeft: number, needEye: boolean, jokersLeft: number, eye: WinEye | null) => {
    if (out.length >= DECOMPOSITION_CAP) return;
    const i = firstTile(counts);
    if (i === -1) {
      if (jokersLeft === meldsLeft * 3 + (needEye ? 2 : 0)) {
        for (let m = 0; m < meldsLeft; m++) {
          sets.push({ type: 'pung', suit: null, rank: null, jokers: 3, exposed: false });
        }
        emit(needEye ? { face: null, jokers: 2 } : (eye as WinEye));
        for (let m = 0; m < meldsLeft; m++) sets.pop();
      }
      return;
    }
    if (meldsLeft === 0 && !needEye) return;

    const face = faceFromIndex(i);
    const rankOffset = i % 9;

    if (meldsLeft > 0) {
      for (let real = Math.min(3, counts[i]); real >= 1; real--) {
        const need = 3 - real;
        if (need > jokersLeft) continue;
        counts[i] -= real;
        sets.push({ type: 'pung', suit: face.suit, rank: face.rank, jokers: need, exposed: false });
        rec(meldsLeft - 1, needEye, jokersLeft - need, eye);
        sets.pop();
        counts[i] += real;
      }
      if (rankOffset <= 6) {
        const j = i + 1;
        const k = i + 2;
        for (const useJokerJ of [false, true]) {
          if (!useJokerJ && counts[j] === 0) continue;
          for (const useJokerK of [false, true]) {
            if (!useJokerK && counts[k] === 0) continue;
            const need = (useJokerJ ? 1 : 0) + (useJokerK ? 1 : 0);
            if (need > jokersLeft) continue;
            counts[i]--;
            if (!useJokerJ) counts[j]--;
            if (!useJokerK) counts[k]--;
            sets.push({ type: 'chow', suit: face.suit, rank: face.rank, jokers: need, exposed: false });
            rec(meldsLeft - 1, needEye, jokersLeft - need, eye);
            sets.pop();
            counts[i]++;
            if (!useJokerJ) counts[j]++;
            if (!useJokerK) counts[k]++;
          }
        }
      }
    }

    if (needEye) {
      if (counts[i] >= 2) {
        counts[i] -= 2;
        rec(meldsLeft, false, jokersLeft, { face, jokers: 0 });
        counts[i] += 2;
      }
      if (jokersLeft >= 1) {
        counts[i] -= 1;
        rec(meldsLeft, false, jokersLeft - 1, { face, jokers: 1 });
        counts[i] += 1;
      }
    }
  };

  const work = [...counts];
  rec(meldsNeeded, true, jokers, null);
  // `rec` restores counts as it unwinds; assert we left them untouched.
  for (let i = 0; i < 27; i++) counts[i] = work[i];
  return out;
}

/** Exposed melds reduce `meldsNeeded` and never enter the concealed search. */
export function meldToWinSet(meld: Meld): WinSet {
  const first = meld.tiles.find(isSuited);
  const suit = first ? first.suit : null;
  if (meld.type === 'chow') {
    const ranks = meld.tiles.filter(isSuited).map((t) => t.rank);
    return { type: 'chow', suit, rank: (Math.min(...ranks) as Rank) ?? null, jokers: 0, exposed: true };
  }
  return {
    type: meld.type,
    suit,
    rank: first ? first.rank : null,
    jokers: 0,
    exposed: true,
  };
}

export function kangCount(melds: Meld[]): number {
  return melds.filter((m) => m.type === 'kang').length;
}

/**
 * The invariant every hand must satisfy at rest:
 *   concealed + melded === 17 + one extra tile per kang
 */
export function expectedTileCount(melds: Meld[]): number {
  return 17 + kangCount(melds);
}

export function handTileCount(concealed: Tile[], melds: Meld[]): number {
  return concealed.length + melds.reduce((n, m) => n + m.tiles.length, 0);
}

export type WinCheckInput = {
  concealed: Tile[];
  melds: Meld[];
  joker: Face | null;
  sieteParesRequiresConcealed: boolean;
};

/** Fast boolean check — used on every draw by the AI and the hint system. */
export function isWinningHand(input: WinCheckInput): boolean {
  const { concealed, melds, joker } = input;
  if (handTileCount(concealed, melds) !== expectedTileCount(melds)) return false;
  const { counts, jokers } = toCounts(concealed, joker);
  const meldsNeeded = 5 - melds.length;
  if (meldsNeeded < 0) return false;
  if (canFormSets(counts, meldsNeeded, true, jokers)) return true;
  return isSietePares(input) !== null;
}

/**
 * *Siete pares* — seven pairs plus one báhay (7×2 + 3 = 17). A distinct win
 * condition, not a variation of the standard shape. At most one joker per pair.
 */
export function isSietePares(input: WinCheckInput): { pairs: (Face | null)[]; set: WinSet } | null {
  const { concealed, melds, joker, sieteParesRequiresConcealed } = input;
  if (melds.some((m) => m.type === 'kang')) return null;
  if (melds.length > 1) return null;
  if (sieteParesRequiresConcealed && melds.length > 0) return null;
  if (handTileCount(concealed, melds) !== 17) return null;

  const { counts, jokers } = toCounts(concealed, joker);
  const work = [...counts];

  // The báhay is either the single exposed meld, or one set drawn from the
  // concealed pool.
  const candidates: { set: WinSet; remove: (() => boolean) | null }[] = [];
  if (melds.length === 1) {
    candidates.push({ set: meldToWinSet(melds[0]), remove: null });
  } else {
    for (let i = 0; i < 27; i++) {
      const face = faceFromIndex(i);
      if (work[i] >= 3) {
        candidates.push({
          set: { type: 'pung', suit: face.suit, rank: face.rank, jokers: 0, exposed: false },
          remove: () => {
            work[i] -= 3;
            return true;
          },
        });
      }
      const offset = i % 9;
      if (offset <= 6 && work[i] > 0 && work[i + 1] > 0 && work[i + 2] > 0) {
        candidates.push({
          set: { type: 'chow', suit: face.suit, rank: face.rank, jokers: 0, exposed: false },
          remove: () => {
            work[i]--;
            work[i + 1]--;
            work[i + 2]--;
            return true;
          },
        });
      }
    }
  }

  for (const candidate of candidates) {
    for (let i = 0; i < 27; i++) work[i] = counts[i];
    if (candidate.remove) candidate.remove();

    let jokersLeft = jokers;
    const pairs: (Face | null)[] = [];
    let ok = true;
    for (let i = 0; i < 27 && ok; i++) {
      while (work[i] >= 2) {
        pairs.push(faceFromIndex(i));
        work[i] -= 2;
      }
      if (work[i] === 1) {
        // A lone tile needs a joker to become a pair — at most one per pair.
        if (jokersLeft === 0) {
          ok = false;
          break;
        }
        jokersLeft--;
        pairs.push(faceFromIndex(i));
        work[i] = 0;
      }
    }
    if (!ok) continue;
    // At most one joker per pair, so every remaining joker had to pair with a
    // lone real tile. Leftover jokers mean this candidate does not work.
    if (jokersLeft !== 0) continue;
    if (pairs.length !== 7) continue;
    return { pairs, set: candidate.set };
  }
  return null;
}

/** All winning shapes for a hand — used by scoring to pick the best-paying one. */
export function analyseWin(input: WinCheckInput): WinShape[] {
  const { concealed, melds, joker } = input;
  const shapes: WinShape[] = [];
  if (handTileCount(concealed, melds) !== expectedTileCount(melds)) return shapes;

  const meldsNeeded = 5 - melds.length;
  if (meldsNeeded >= 0) {
    const { counts, jokers } = toCounts(concealed, joker);
    if (canFormSets(counts, meldsNeeded, true, jokers)) {
      const exposed = melds.map(meldToWinSet);
      for (const d of decompose(counts, meldsNeeded, jokers)) {
        shapes.push({ kind: 'standard', sets: [...exposed, ...d.sets], pairs: [], eye: d.eye });
      }
    }
  }

  const siete = isSietePares(input);
  if (siete) {
    shapes.push({ kind: 'siete', sets: [siete.set], pairs: siete.pairs, eye: null });
  }
  return shapes;
}

/**
 * Which faces would complete this hand? Drives the hint system ("what am I
 * waiting on?"), the AI's evaluator, and the back-to-back ambition check.
 */
export function winningFaces(input: WinCheckInput): Face[] {
  const { concealed, melds, joker, sieteParesRequiresConcealed } = input;
  if (handTileCount(concealed, melds) !== expectedTileCount(melds) - 1) return [];
  const out: Face[] = [];
  for (let i = 0; i < 27; i++) {
    const face = faceFromIndex(i);
    const probe: Tile = { kind: 'suited', suit: face.suit, rank: face.rank, id: `probe-${i}` };
    if (
      isWinningHand({
        concealed: [...concealed, probe],
        melds,
        joker,
        sieteParesRequiresConcealed,
      })
    ) {
      out.push(face);
    }
  }
  return out;
}

/** Concealed faces held three or more times — candidates for a concealed kang. */
export function concealedKangFaces(concealed: Tile[]): Face[] {
  const counts = emptyCounts();
  for (const tile of concealed) if (isSuited(tile)) counts[faceIndex(tile.suit, tile.rank)]++;
  const out: Face[] = [];
  for (let i = 0; i < 27; i++) if (counts[i] >= 4) out.push(faceFromIndex(i));
  return out;
}

export function countFace(tiles: Tile[], face: Face): number {
  return tiles.filter((t) => t.kind === 'suited' && t.suit === face.suit && t.rank === face.rank)
    .length;
}

export function allFaces(): Face[] {
  const out: Face[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) out.push({ suit, rank: rank as Rank });
  }
  return out;
}
