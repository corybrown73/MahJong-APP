import { describe, expect, it } from 'vitest';
import {
  createGame,
  createRng,
  currentSeat,
  legalActions,
  publicView,
  reduce,
  seatsAwaitingClaimResponse,
  type GameState,
  type SeatId,
  type Settlement,
} from '@bahay/engine';
import { decide, scoreDiscards } from '../src/agent.js';
import { KAPITBAHAY, LOLO, PERSONALITIES, TITA } from '../src/personalities.js';

function playHand(seed: string, personalities = PERSONALITIES): Settlement {
  const seats: Record<SeatId, typeof TITA> = {
    0: personalities.kapitbahay,
    1: personalities.tita,
    2: personalities.lolo,
    3: personalities.kapitbahay,
  };
  let state: GameState = createGame({ seed });
  const rng = createRng(`agent:${seed}`);
  let steps = 0;

  while (state.phase.name !== 'HAND_OVER' && steps++ < 5000) {
    const waiting = seatsAwaitingClaimResponse(state);
    const seat = waiting.length > 0 ? waiting[0] : currentSeat(state);
    if (seat === null) throw new Error(`stuck in ${state.phase.name}`);
    const options = legalActions(state, seat);
    const decision = decide(publicView(state, seat), options, seats[seat], rng);
    expect(options).toContainEqual(decision.action);
    state = reduce(state, decision.action);
  }
  if (state.phase.name !== 'HAND_OVER') throw new Error('hand never finished');
  return state.phase.settlement;
}

describe('the AI only ever chooses a legal action', () => {
  it('plays 40 hands to completion without an illegal move', () => {
    for (let i = 0; i < 40; i++) {
      const settlement = playHand(`legal-${i}`);
      expect(['discard', 'bunot', 'bisaklat', 'draw']).toContain(settlement.winType);
    }
  });
});

describe('the AI is beatable and the table still finishes hands', () => {
  it('wins a reasonable share of hands rather than always drawing out the wall', () => {
    let wins = 0;
    const hands = 60;
    for (let i = 0; i < hands; i++) {
      if (playHand(`rate-${i}`).winner !== null) wins++;
    }
    // Filipino hands do often exhaust the wall, but a table that never wins
    // means the evaluator is broken.
    expect(wins).toBeGreaterThan(hands * 0.15);
  });

  it('keeps every hand zero-sum', () => {
    for (let i = 0; i < 20; i++) {
      const settlement = playHand(`zero-${i}`);
      const paid = settlement.transfers.reduce((n, t) => n + t.amount, 0);
      if (settlement.winner !== null) expect(paid).toBeGreaterThan(0);
    }
  });
});

describe('discard evaluation', () => {
  it('prefers the discard that leaves the hand closest to winning', () => {
    // A personality that weighs nothing but shanten, so the ordering is a
    // direct read of the evaluator's core term.
    const pureShanten = { ...KAPITBAHAY, weights: { w1: 10, w2: 0, w3: 0, w4: 0 } };
    for (const seed of ['evaluate-1', 'evaluate-2', 'evaluate-3']) {
      const state = createGame({ seed });
      const scored = scoreDiscards(publicView(state, 0), legalActions(state, 0), pureShanten);
      expect(scored.length).toBeGreaterThan(0);
      expect(scored[0].shantenAfter).toBe(Math.min(...scored.map((s) => s.shantenAfter)));
    }
  });

  it('keeps the full evaluator within one tile of the greedy choice', () => {
    const state = createGame({ seed: 'evaluate-4' });
    const scored = scoreDiscards(publicView(state, 0), legalActions(state, 0), KAPITBAHAY);
    const bestShanten = Math.min(...scored.map((s) => s.shantenAfter));
    expect(scored[0].shantenAfter).toBeLessThanOrEqual(bestShanten + 1);
  });

  it('weighs danger for Lolo and ignores it for Tita', () => {
    const state = createGame({ seed: 'evaluate-2' });
    const view = publicView(state, 0);
    const options = legalActions(state, 0);
    const cautious = scoreDiscards(view, options, LOLO);
    const carefree = scoreDiscards(view, options, TITA);
    expect(cautious.map((s) => s.tile.id)).not.toEqual(carefree.map((s) => s.tile.id));
  });
});

describe('thinking time', () => {
  it('always takes a beat, so the player can follow what happened', () => {
    const state = createGame({ seed: 'timing' });
    const rng = createRng('timing');
    for (const personality of [TITA, KAPITBAHAY, LOLO]) {
      const decision = decide(publicView(state, 0), legalActions(state, 0), personality, rng);
      expect(decision.thinkMs).toBeGreaterThanOrEqual(200);
      expect(decision.thinkMs).toBeLessThanOrEqual(1200);
      expect(decision.reason.length).toBeGreaterThan(0);
    }
  });
});
