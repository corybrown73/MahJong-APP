import { createGame } from '../src/game.js';
import { cloneRuleset, STANDARD } from '../src/rulesets.js';
import type { Face, GameState, Meld, Rank, Ruleset, SeatId, Suit, Tile } from '../src/types.js';

const SUIT_CODES: Record<string, Suit> = { b: 'balls', k: 'sticks', c: 'chars' };

/**
 * Compact hand notation for tests: "b123 k456 c789 b55" -> tiles.
 *   b = bolá (balls), k = kahoy (sticks), c = letra (chars)
 */
export function tiles(spec: string): Tile[] {
  const out: Tile[] = [];
  const used = new Map<string, number>();
  for (const group of spec.trim().split(/\s+/)) {
    if (!group) continue;
    const suit = SUIT_CODES[group[0]];
    if (!suit) throw new Error(`bad suit code in "${group}"`);
    for (const ch of group.slice(1)) {
      const rank = Number(ch) as Rank;
      if (!rank || rank < 1 || rank > 9) throw new Error(`bad rank in "${group}"`);
      const key = `${suit}-${rank}`;
      const copy = used.get(key) ?? 0;
      used.set(key, copy + 1);
      out.push({ kind: 'suited', suit, rank, id: `${key}-c${copy}` });
    }
  }
  return out;
}

export function tile(spec: string): Tile {
  const [only] = tiles(spec);
  return only;
}

export function face(spec: string): Face {
  const t = tile(spec);
  if (t.kind !== 'suited') throw new Error('not a suited tile');
  return { suit: t.suit, rank: t.rank };
}

export function pung(spec: string): Meld {
  const t = tiles(spec);
  if (t.length !== 3) throw new Error('pung needs 3 tiles');
  return { type: 'pung', tiles: [t[0], t[1], t[2]], claimedFrom: 1 };
}

export function chow(spec: string): Meld {
  const t = tiles(spec);
  if (t.length !== 3) throw new Error('chow needs 3 tiles');
  return { type: 'chow', tiles: [t[0], t[1], t[2]], claimedFrom: 3 };
}

export function kang(spec: string, variant: 'open' | 'secret' | 'sagasa' = 'open'): Meld {
  const t = tiles(spec);
  if (t.length !== 4) throw new Error('kang needs 4 tiles');
  return {
    type: 'kang',
    tiles: [t[0], t[1], t[2], t[3]],
    variant,
    claimedFrom: variant === 'open' ? 1 : null,
  };
}

export type TableSpec = {
  /** Concealed hands, seat 0 first. Anything omitted keeps the dealt hand. */
  hands?: (string | undefined)[];
  melds?: (Meld[] | undefined)[];
  ruleset?: Partial<Ruleset>;
  dealerSeat?: SeatId;
  seed?: string;
  joker?: Face | null;
};

/**
 * A real game state with hands overridden, for testing calls and scoring
 * without having to play a hand into a particular shape.
 */
export function table(spec: TableSpec = {}): GameState {
  const ruleset: Ruleset = { ...cloneRuleset(STANDARD), ...(spec.ruleset ?? {}) };
  if (spec.ruleset?.ambitionValues) {
    ruleset.ambitionValues = { ...ruleset.ambitionValues, ...spec.ruleset.ambitionValues };
  }
  const state = createGame({
    seed: spec.seed ?? 'test-seed',
    ruleset,
    dealerSeat: spec.dealerSeat ?? 0,
  });
  state.joker = spec.joker === undefined ? null : spec.joker;
  for (let seat = 0; seat < 4; seat++) {
    const hand = spec.hands?.[seat];
    if (hand !== undefined) state.players[seat].concealed = tiles(hand);
    const melds = spec.melds?.[seat];
    if (melds !== undefined) state.players[seat].melds = melds;
  }
  return state;
}
