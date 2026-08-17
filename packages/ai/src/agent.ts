/**
 * The opponent evaluator.
 *
 * The AI never sees concealed hands or the wall order — it is handed a
 * PublicGameView plus the legal actions the engine computed for its own seat,
 * and nothing else. All three difficulties share this evaluator; they differ
 * only in weights, how often they miss a call, and how long they think.
 */

import {
  isSuited,
  unseenCount,
  type Action,
  type Face,
  type PublicGameView,
  type Rng,
  type SeatId,
  type Tile,
} from '@bahay/engine';
import { acceptingFaces, shanten } from './shanten.js';
import type { Personality } from './personalities.js';

export type Decision = {
  action: Action;
  /** How long the UI should hold before applying it. */
  thinkMs: number;
  /** Why, in one line — surfaced in coach mode and useful in tests. */
  reason: string;
};

function faceOf(tile: Tile): Face | null {
  return isSuited(tile) ? { suit: tile.suit, rank: tile.rank } : null;
}

function thinkTime(personality: Personality, rng: Rng): number {
  const [low, high] = personality.thinkMs;
  return low + rng.int(high - low + 1);
}

/**
 * How exposed is this tile? A tile nobody has discarded, in a suit an opponent
 * is visibly collecting, is dangerous. This is a heuristic read of public
 * information — exactly what a human does.
 */
function danger(view: PublicGameView, tile: Tile): number {
  const face = faceOf(tile);
  if (!face) return 0;

  const discardedCopies = view.discards.filter(
    (d) => isSuited(d.tile) && d.tile.suit === face.suit && d.tile.rank === face.rank,
  ).length;
  // Anything already thrown twice is close to safe.
  let score = Math.max(0, 2 - discardedCopies);

  // Terminals are safer than middle tiles: fewer runs pass through them.
  if (face.rank === 1 || face.rank === 9) score *= 0.6;
  else if (face.rank >= 4 && face.rank <= 6) score *= 1.3;

  // Someone melding a suit heavily is probably collecting it.
  for (const player of view.players) {
    if (player.seat === view.seat) continue;
    const sameSuit = player.melds.filter((m) =>
      m.tiles.some((t) => isSuited(t) && t.suit === face.suit),
    ).length;
    score += sameSuit * 0.5;
  }
  return score;
}

/** Is an ambition within reach? Rewards committing to a flush or a run. */
function ambitionPotential(view: PublicGameView, hand: Tile[], personality: Personality): number {
  const suited = hand.filter(isSuited);
  if (suited.length === 0) return 0;
  const bySuit = new Map<string, number>();
  for (const tile of suited) bySuit.set(tile.suit, (bySuit.get(tile.suit) ?? 0) + 1);
  const dominant = Math.max(...bySuit.values());
  const flushProgress = dominant / suited.length;

  let score = 0;
  if (flushProgress > 0.75) score += personality.bias === 'flush' ? 2 : 1;

  // Escaléra: how much of a 1-9 run is already held in the dominant suit?
  for (const [suit, count] of bySuit) {
    if (count < 7) continue;
    const ranks = new Set(suited.filter((t) => t.suit === suit).map((t) => t.rank));
    if (ranks.size >= 8) score += 1.5;
  }

  // Siete pares: lots of pairs.
  const counts = new Map<string, number>();
  for (const tile of suited) {
    const key = `${tile.suit}-${tile.rank}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const pairs = [...counts.values()].filter((n) => n >= 2).length;
  if (pairs >= 5) score += 1.5;

  return score;
}

function liveAcceptance(view: PublicGameView, hand: Tile[], melds: PublicGameView['melds']): number {
  const faces = acceptingFaces({ concealed: hand, melds, joker: view.joker });
  return faces.reduce((n, face) => n + unseenCount(view, face), 0);
}

export type DiscardScore = {
  action: Action;
  tile: Tile;
  score: number;
  shantenAfter: number;
  acceptance: number;
  danger: number;
};

export function scoreDiscards(
  view: PublicGameView,
  options: Action[],
  personality: Personality,
): DiscardScore[] {
  const { w1, w2, w3, w4 } = personality.weights;
  const discards = options.filter((a) => a.type === 'DISCARD');
  const seen = new Set<string>();
  const scored: DiscardScore[] = [];

  for (const action of discards) {
    if (action.type !== 'DISCARD') continue;
    const tile = view.hand.find((t) => t.id === action.tileId);
    if (!tile) continue;
    // Two copies of the same face are the same decision.
    const key = isSuited(tile) ? `${tile.suit}-${tile.rank}` : tile.id;
    if (seen.has(key)) continue;
    seen.add(key);

    const rest = view.hand.filter((t) => t.id !== tile.id);
    const after = shanten({ concealed: rest, melds: view.melds, joker: view.joker });
    const acceptance = after <= 2 ? liveAcceptance(view, rest, view.melds) : 0;
    const ambition = ambitionPotential(view, rest, personality);
    const risk = danger(view, tile);

    const score = w1 * -after + w2 * acceptance + w3 * ambition - w4 * risk;
    scored.push({ action, tile, score, shantenAfter: after, acceptance, danger: risk });
  }

  return scored.sort((a, b) => b.score - a.score);
}

/** Playing defence: throw the safest tile and stop building. */
function foldDiscard(view: PublicGameView, options: Action[]): Action | null {
  const discards = options.filter((a) => a.type === 'DISCARD');
  let safest: { action: Action; risk: number } | null = null;
  for (const action of discards) {
    if (action.type !== 'DISCARD') continue;
    const tile = view.hand.find((t) => t.id === action.tileId);
    if (!tile) continue;
    const risk = danger(view, tile);
    if (!safest || risk < safest.risk) safest = { action, risk };
  }
  return safest?.action ?? null;
}

function handIsHopeless(view: PublicGameView): boolean {
  const distance = shanten({ concealed: view.hand, melds: view.melds, joker: view.joker });
  return distance >= 4 && view.tilesRemaining < 40;
}

/**
 * Decide what to do. `options` must be `legalActions(state, seat)` for this
 * AI's own seat — the engine is the authority on legality, always.
 */
export function decide(
  view: PublicGameView,
  options: Action[],
  personality: Personality,
  rng: Rng,
): Decision {
  const thinkMs = thinkTime(personality, rng);

  // Winning is never declined.
  const todas =
    options.find((a) => a.type === 'DECLARE_TODAS') ??
    options.find((a) => a.type === 'CLAIM' && a.call === 'todas');
  if (todas) return { action: todas, thinkMs, reason: 'Tódas — the hand is complete' };

  const draw = options.find((a) => a.type === 'DRAW');
  if (draw) return { action: draw, thinkMs: Math.round(thinkMs * 0.5), reason: 'Draw' };

  const claims = options.filter((a) => a.type === 'CLAIM');
  if (claims.length > 0) {
    const pass = options.find((a) => a.type === 'PASS');
    if (pass && rng.next() < personality.missesCallChance) {
      return { action: pass, thinkMs, reason: 'Let it go' };
    }
    const best = chooseClaim(view, claims, personality);
    if (best) return { action: best.action, thinkMs, reason: best.reason };
    if (pass) return { action: pass, thinkMs, reason: 'No improvement in calling' };
  }

  const pass = options.find((a) => a.type === 'PASS');
  if (pass) return { action: pass, thinkMs, reason: 'Pass' };

  // Kang declarations are worth taking: they pay immediately.
  const kang = options.find((a) => a.type === 'SECRET_KANG' || a.type === 'SAGASA');
  if (kang && rng.next() < 0.8) {
    return { action: kang, thinkMs, reason: 'Kang pays right now' };
  }

  if (personality.foldsWhenHopeless && handIsHopeless(view)) {
    const safe = foldDiscard(view, options);
    if (safe) return { action: safe, thinkMs, reason: 'Folding — playing safe tiles' };
  }

  const scored = scoreDiscards(view, options, personality);
  if (scored.length > 0) {
    const top = scored[0];
    return {
      action: top.action,
      thinkMs,
      reason: `Discard leaves ${top.shantenAfter} away, ${top.acceptance} live tiles help`,
    };
  }

  const fallback = options[0];
  if (!fallback) throw new Error('no legal action to choose from');
  return { action: fallback, thinkMs, reason: 'Only option' };
}

/**
 * Would this call actually help? A call that does not reduce shanten is
 * usually a mistake — it exposes information and costs flexibility.
 */
function chooseClaim(
  view: PublicGameView,
  claims: Action[],
  personality: Personality,
): { action: Action; reason: string } | null {
  const before = shanten({ concealed: view.hand, melds: view.melds, joker: view.joker });
  let best: { action: Action; gain: number; reason: string } | null = null;

  for (const claim of claims) {
    if (claim.type !== 'CLAIM') continue;
    const consumed = new Set(claim.tileIds);
    const rest = view.hand.filter((t) => !consumed.has(t.id));
    // The claimed set becomes a meld, so one fewer set has to come from hand.
    const pseudoMelds = [
      ...view.melds,
      { type: 'pung' as const, tiles: [view.hand[0], view.hand[0], view.hand[0]] as never, claimedFrom: null },
    ];
    const after = shanten({ concealed: rest, melds: pseudoMelds, joker: view.joker });
    let gain = before - after;
    if (claim.call === 'kang') gain += 1; // pays immediately
    if (claim.call === 'chow' && personality.bias === 'safe') gain -= 0.5;
    if (personality.bias === 'aggressive') gain += 0.5;
    if (!best || gain > best.gain) {
      best = {
        action: claim,
        gain,
        reason: `${claim.call} — ${gain > 0 ? 'improves the hand' : 'holds shape'}`,
      };
    }
  }

  if (!best) return null;
  return best.gain > 0 ? { action: best.action, reason: best.reason } : null;
}

export function seatName(seat: SeatId, personalities: Record<number, Personality>): string {
  return personalities[seat]?.name ?? `Seat ${seat}`;
}
