/**
 * Ambitions (*ambisyon*) and settlement.
 *
 * `settle` returns an itemized breakdown, never a bare number: the win screen
 * shows the player exactly why they were paid what they were paid.
 */

import { analyseWin, countFace, winningFaces, type WinShape } from './hand.js';
import { ambitionValue, AMBITION_BY_ID } from './rulesets.js';
import { isSuited } from './tiles.js';
import type {
  AmbitionId,
  Face,
  GameState,
  ImmediatePayout,
  SeatId,
  Settlement,
  SettlementItem,
  Suit,
  Tile,
  Transfer,
} from './types.js';

export const SEAT_IDS: SeatId[] = [0, 1, 2, 3];

function label(id: AmbitionId): string {
  const def = AMBITION_BY_ID[id];
  return def.filipino && def.filipino !== def.label ? `${def.label} (${def.filipino})` : def.label;
}

function shapeSuits(shape: WinShape): (Suit | null)[] {
  const suits: (Suit | null)[] = shape.sets.map((s) => s.suit);
  if (shape.eye) suits.push(shape.eye.face ? shape.eye.face.suit : null);
  for (const pair of shape.pairs) suits.push(pair ? pair.suit : null);
  return suits;
}

function isFullFlush(shape: WinShape): boolean {
  const suits = shapeSuits(shape).filter((s): s is Suit => s !== null);
  return suits.length > 0 && suits.every((s) => s === suits[0]);
}

function isEscalera(shape: WinShape): boolean {
  if (shape.kind !== 'standard') return false;
  for (const suit of ['balls', 'sticks', 'chars'] as Suit[]) {
    const chowRanks = new Set(
      shape.sets.filter((s) => s.type === 'chow' && s.suit === suit).map((s) => s.rank),
    );
    if (chowRanks.has(1) && chowRanks.has(4) && chowRanks.has(7)) return true;
  }
  return false;
}

export type WaitShape = 'paningit' | 'singleWait' | 'backToBack' | null;

/**
 * The wait ambitions all describe the same thing — the shape of the final wait
 * — so at most one may be scored. Returns every one that applies; the caller
 * keeps the highest-value.
 */
export function waitShapes(
  shape: WinShape,
  winningFace: Face | null,
  concealedBefore: Tile[] | null,
  melds: GameState['players'][number]['melds'],
  joker: Face | null,
  sieteParesRequiresConcealed: boolean,
): Exclude<WaitShape, null>[] {
  if (!winningFace) return [];
  const out: Exclude<WaitShape, null>[] = [];

  // Paníngit — won on the middle tile of a chow.
  const middleOfChow = shape.sets.some(
    (s) =>
      s.type === 'chow' &&
      !s.exposed &&
      s.suit === winningFace.suit &&
      s.rank !== null &&
      s.rank + 1 === winningFace.rank,
  );
  if (middleOfChow) out.push('paningit');

  // Single wait — won on the eye, or an edge wait.
  const wonOnEye =
    !!shape.eye &&
    !!shape.eye.face &&
    shape.eye.face.suit === winningFace.suit &&
    shape.eye.face.rank === winningFace.rank;
  const edgeWait = shape.sets.some(
    (s) =>
      s.type === 'chow' &&
      !s.exposed &&
      s.suit === winningFace.suit &&
      ((s.rank === 1 && winningFace.rank === 3) || (s.rank === 7 && winningFace.rank === 7)),
  );
  if (wonOnEye || edgeWait) out.push('singleWait');

  // Back to back — the hand before the winning tile was waiting on either of
  // two pairs to become the winning set.
  if (concealedBefore) {
    const waits = winningFaces({
      concealed: concealedBefore,
      melds,
      joker,
      sieteParesRequiresConcealed,
    });
    if (
      waits.length === 2 &&
      waits.every((face) => countFace(concealedBefore, face) === 2) &&
      waits.some((face) => face.suit === winningFace.suit && face.rank === winningFace.rank)
    ) {
      out.push('backToBack');
    }
  }

  return out;
}

export type WinContext = {
  state: GameState;
  winner: SeatId;
  winType: 'discard' | 'bunot' | 'bisaklat';
  discarder: SeatId | null;
  /** The tile that completed the hand. Null for bisaklát. */
  winningTile: Tile | null;
  /** The concealed pool *before* the winning tile joined it. */
  concealedBefore: Tile[] | null;
};

function scoreShape(ctx: WinContext, shape: WinShape): SettlementItem[] {
  const { state, winner } = ctx;
  const ruleset = state.ruleset;
  const player = state.players[winner];
  const items: SettlementItem[] = [];
  const add = (id: AmbitionId) => {
    const value = ambitionValue(ruleset, id);
    if (value !== 0) items.push({ ambition: id, label: label(id), value });
  };

  add('todas');

  if (shape.kind === 'siete') add('sietePares');
  if (isEscalera(shape)) add('escalera');
  if (isFullFlush(shape)) add('fullFlush');

  const hasChow = shape.sets.some((s) => s.type === 'chow');
  const hasPungLike = shape.sets.some((s) => s.type === 'pung' || s.type === 'kang');
  if (shape.kind === 'standard' && !hasChow) add('allPungs');
  if (shape.kind === 'standard' && !hasPungLike) add('allChows');

  // A secret (concealed) kang does not break a concealed hand; an open kang or
  // a sagása does.
  const exposedMelds = player.melds.filter(
    (m) => !(m.type === 'kang' && m.variant === 'secret'),
  );
  if (exposedMelds.length === 0) add('concealedHand');
  if (shape.kind === 'standard' && exposedMelds.length === 5) add('allRevealed');

  if (state.discards.length <= ruleset.quickWinDiscardLimit) add('quickWin');

  const winningFace =
    ctx.winningTile && isSuited(ctx.winningTile)
      ? { suit: ctx.winningTile.suit, rank: ctx.winningTile.rank }
      : null;
  const waits = waitShapes(
    shape,
    winningFace,
    ctx.concealedBefore,
    player.melds,
    state.joker,
    ruleset.sieteParesRequiresConcealed,
  );
  if (waits.length > 0) {
    const best = waits
      .map((id) => ({ id, value: ambitionValue(ruleset, id) }))
      .sort((a, b) => b.value - a.value)[0];
    if (best.value !== 0) items.push({ ambition: best.id, label: label(best.id), value: best.value });
  }

  return items;
}

function transfersFor(
  winner: SeatId,
  winType: WinContext['winType'],
  discarder: SeatId | null,
  total: number,
): Transfer[] {
  const out: Transfer[] = [];
  for (const seat of SEAT_IDS) {
    if (seat === winner) continue;
    const amount = winType === 'discard' && seat === discarder ? total * 2 : total;
    out.push({ from: seat, to: winner, amount });
  }
  return out;
}

export function settle(ctx: WinContext): Settlement {
  const { state, winner, winType, discarder } = ctx;
  const ruleset = state.ruleset;

  if (winType === 'bisaklat') {
    // Flat, and it replaces all other scoring.
    const value = ruleset.bisaklatValue;
    const items: SettlementItem[] = [
      { ambition: 'bisaklat', label: label('bisaklat'), value },
    ];
    return {
      winner,
      winType,
      discarder: null,
      items,
      multipliers: [],
      total: value,
      transfers: transfersFor(winner, 'bunot', null, value),
      immediate: state.immediate,
    };
  }

  const player = state.players[winner];
  const shapes = analyseWin({
    concealed: player.concealed,
    melds: player.melds,
    joker: state.joker,
    sieteParesRequiresConcealed: ruleset.sieteParesRequiresConcealed,
  });

  let bestItems: SettlementItem[] = [
    { ambition: 'todas', label: label('todas'), value: ambitionValue(ruleset, 'todas') },
  ];
  let bestSum = bestItems.reduce((n, i) => n + i.value, 0);
  for (const shape of shapes) {
    const items = scoreShape(ctx, shape);
    const sum = items.reduce((n, i) => n + i.value, 0);
    if (sum > bestSum) {
      bestSum = sum;
      bestItems = items;
    }
  }

  // A player who reaches a win having never drawn a single flower is paid for
  // No Flowers a second time.
  if (!player.everDrewFlower) {
    const value = ambitionValue(ruleset, 'noFlowers');
    if (value !== 0) {
      bestItems.push({ ambition: 'noFlowers', label: `${label('noFlowers')} (at the win)`, value });
      bestSum += value;
    }
  }

  const multipliers: { label: string; factor: number }[] = [];
  if (winType === 'bunot') {
    multipliers.push({ label: label('bunot'), factor: ambitionValue(ruleset, 'bunot') });
  }
  if (state.doublesActive) multipliers.push({ label: 'Doubles roll', factor: 2 });

  const total = multipliers.reduce((n, m) => n * m.factor, bestSum);

  return {
    winner,
    winType,
    discarder: winType === 'discard' ? discarder : null,
    items: bestItems,
    multipliers,
    total: round2(total),
    transfers: transfersFor(winner, winType, discarder, round2(total)),
    immediate: state.immediate,
  };
}

export function drawSettlement(state: GameState): Settlement {
  return {
    winner: null,
    winType: 'draw',
    discarder: null,
    items: [],
    multipliers: [],
    total: 0,
    transfers: [],
    immediate: state.immediate,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Immediate ambitions: everyone else pays the declarer, right now. */
export function buildImmediatePayout(
  state: GameState,
  seat: SeatId,
  ambition: AmbitionId,
): ImmediatePayout {
  const value = ambitionValue(state.ruleset, ambition);
  return {
    ambition,
    label: label(ambition),
    seat,
    value,
    amount: round2(value * 3),
  };
}
