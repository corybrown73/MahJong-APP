/**
 * Claiming a discard: legality and priority.
 *
 *   Tódas  >  Kang  =  Pung  >  Chow
 *
 * Kang and pung can never actually collide — a kang claim needs three
 * concealed copies and a pung claim two, which with the discard would need six
 * copies of a four-copy tile — so they share a priority tier.
 */

import { isWinningHand } from './hand.js';
import { isSuited } from './tiles.js';
import type { CallType, Claim, Face, GameState, PlayerState, Rank, SeatId, Tile } from './types.js';

export const SEATS: SeatId[] = [0, 1, 2, 3];

export function nextSeat(seat: SeatId): SeatId {
  return ((seat + 1) % 4) as SeatId;
}

/** Seat N may chow only from seat (N + 3) % 4 — the player before them. */
export function chowSourceSeat(seat: SeatId): SeatId {
  return ((seat + 3) % 4) as SeatId;
}

/** Distance in turn order from the discarder — used to break tódas ties. */
export function seatDistance(from: SeatId, to: SeatId): number {
  return (to - from + 4) % 4;
}

function sameFaceTiles(tiles: Tile[], face: Face): Tile[] {
  return tiles.filter((t) => isSuited(t) && t.suit === face.suit && t.rank === face.rank);
}

function findTile(tiles: Tile[], suit: Face['suit'], rank: Rank): Tile | undefined {
  return tiles.find((t) => isSuited(t) && t.suit === suit && t.rank === rank);
}

export type ClaimOption = {
  call: CallType;
  tileIds: string[];
  /** For the "?" affordance on the call bar: what this call would do. */
  describe: string;
};

/**
 * Note on jokers: a joker may never be *substituted* into a claim. Tiles whose
 * face happens to be the joker face are ordinary tiles and may be claimed with
 * and melded at face value, per §5.9.
 */
export function chowOptions(hand: Tile[], discard: Tile): ClaimOption[] {
  if (!isSuited(discard)) return [];
  const { suit, rank } = discard;
  const shapes: [number, number][] = [
    [-2, -1],
    [-1, 1],
    [1, 2],
  ];
  const out: ClaimOption[] = [];
  for (const [a, b] of shapes) {
    const ra = rank + a;
    const rb = rank + b;
    if (ra < 1 || ra > 9 || rb < 1 || rb > 9) continue;
    const ta = findTile(hand, suit, ra as Rank);
    const tb = findTile(hand, suit, rb as Rank);
    if (!ta || !tb) continue;
    const ranks = [rank, ra, rb].sort((x, y) => x - y);
    out.push({
      call: 'chow',
      tileIds: [ta.id, tb.id],
      describe: `Chow ${ranks.join('-')} using your ${ra} and ${rb}`,
    });
  }
  return out;
}

export function pungOption(hand: Tile[], discard: Tile): ClaimOption | null {
  if (!isSuited(discard)) return null;
  const matches = sameFaceTiles(hand, discard);
  if (matches.length < 2) return null;
  return {
    call: 'pung',
    tileIds: [matches[0].id, matches[1].id],
    describe: `Pung the ${discard.rank} using your two matching tiles`,
  };
}

export function kangOption(hand: Tile[], discard: Tile): ClaimOption | null {
  if (!isSuited(discard)) return null;
  const matches = sameFaceTiles(hand, discard);
  if (matches.length < 3) return null;
  return {
    call: 'kang',
    tileIds: [matches[0].id, matches[1].id, matches[2].id],
    describe: `Kang the ${discard.rank} using your three matching tiles`,
  };
}

export function todasOption(
  player: PlayerState,
  discard: Tile,
  joker: Face | null,
  sieteParesRequiresConcealed: boolean,
): ClaimOption | null {
  if (!isSuited(discard)) return null;
  const won = isWinningHand({
    concealed: [...player.concealed, discard],
    melds: player.melds,
    joker,
    sieteParesRequiresConcealed,
  });
  if (!won) return null;
  return { call: 'todas', tileIds: [], describe: 'Tódas — this tile completes your hand' };
}

/**
 * Every legal claim `seat` could make on the tile just discarded by `from`.
 * The UI renders exactly this; it never guesses.
 */
export function claimOptions(state: GameState, seat: SeatId, discard: Tile, from: SeatId): ClaimOption[] {
  if (seat === from) return [];
  const player = state.players[seat];
  const options: ClaimOption[] = [];

  const todas = todasOption(player, discard, state.joker, state.ruleset.sieteParesRequiresConcealed);
  if (todas) options.push(todas);

  const kang = kangOption(player.concealed, discard);
  // A kang is illegal if there is no gift tile left to draw (§5.9).
  if (kang && state.drawnFromWall + state.giftsDrawn < 144) options.push(kang);

  const pung = pungOption(player.concealed, discard);
  if (pung) options.push(pung);

  const mayChow = state.ruleset.chowFromAnyPlayer || chowSourceSeat(seat) === from;
  if (mayChow) options.push(...chowOptions(player.concealed, discard));

  return options;
}

export function seatsWithClaims(state: GameState, discard: Tile, from: SeatId): SeatId[] {
  return SEATS.filter((seat) => seat !== from && claimOptions(state, seat, discard, from).length > 0);
}

const PRIORITY: Record<CallType, number> = { todas: 3, kang: 2, pung: 2, chow: 1 };

/**
 * Resolve a completed claim window. Collect first, then apply priority — never
 * first-come-first-served, which is what makes existing apps feel arbitrary.
 */
export function resolveClaims(
  claims: Claim[],
  discarder: SeatId,
  multipleWinnersOnDiscard: boolean,
): { winners: Claim[] } {
  if (claims.length === 0) return { winners: [] };
  const best = Math.max(...claims.map((c) => PRIORITY[c.call]));
  const top = claims.filter((c) => PRIORITY[c.call] === best);
  if (top.length === 1) return { winners: top };

  if (best === PRIORITY.todas) {
    if (multipleWinnersOnDiscard) return { winners: top };
    const sorted = [...top].sort(
      (a, b) => seatDistance(discarder, a.seat) - seatDistance(discarder, b.seat),
    );
    return { winners: [sorted[0]] };
  }

  // Pung/kang tier: nearest seat in turn order wins. (Two pung claims on the
  // same tile are impossible; a pung and a kang share this tier by convention.)
  const sorted = [...top].sort(
    (a, b) => seatDistance(discarder, a.seat) - seatDistance(discarder, b.seat),
  );
  return { winners: [sorted[0]] };
}
