import { describe, expect, it } from 'vitest';
import {
  createGame,
  createRng,
  currentSeat,
  handInvariantHolds,
  legalActions,
  nextHand,
  publicView,
  reduce,
  seatsAwaitingClaimResponse,
  type GameState,
  type SeatId,
} from '@bahay/engine';
import { decide, PERSONALITIES, type Difficulty } from '../src/index.js';

const LEVELS: Difficulty[] = ['kapitbahay', 'tita', 'lolo', 'kapitbahay'];

function playHand(state: GameState): GameState {
  let steps = 0;
  while (state.phase.name !== 'HAND_OVER') {
    if (steps++ > 6000) throw new Error('AI table did not finish a hand');
    expect(handInvariantHolds(state)).toBe(true);

    const seat: SeatId | undefined =
      state.phase.name === 'PENDING_CLAIMS'
        ? seatsAwaitingClaimResponse(state)[0]
        : (currentSeat(state) ?? undefined);
    if (seat === undefined) throw new Error(`no seat to act in ${state.phase.name}`);

    const options = legalActions(state, seat);
    expect(options.length).toBeGreaterThan(0);

    const rng = createRng(`${state.seed}:${state.handNumber}:${state.history.length}:${seat}`);
    const decision = decide(
      publicView(state, seat),
      options,
      PERSONALITIES[LEVELS[seat]],
      rng,
    );
    // Whatever the AI picks must be something the engine offered, and must not
    // throw when applied.
    expect(options).toContainEqual(decision.action);
    expect(decision.thinkMs).toBeGreaterThanOrEqual(0);
    state = reduce(state, decision.action);
  }
  return state;
}

describe('the AI never plays an illegal or impossible move', () => {
  it('plays 25 full AI-only hands', () => {
    for (let i = 0; i < 25; i++) {
      const done = playHand(createGame({ seed: `ai-probe-${i}` }));
      expect(done.phase.name).toBe('HAND_OVER');
      const total = done.players.reduce((n, p) => n + p.chips, 0);
      expect(Math.abs(total)).toBeLessThan(1e-9);
    }
  });

  it('carries a table through six consecutive hands', () => {
    let state = playHand(createGame({ seed: 'ai-session' }));
    for (let hand = 0; hand < 6; hand++) {
      state = playHand(nextHand(state));
      expect(state.phase.name).toBe('HAND_OVER');
    }
  });

  it('always takes a win it is offered', () => {
    // Over many hands, no AI should ever pass up a tódas it could declare.
    for (let i = 0; i < 12; i++) {
      let state = createGame({ seed: `ai-win-${i}` });
      let steps = 0;
      while (state.phase.name !== 'HAND_OVER' && steps++ < 6000) {
        const seat: SeatId | undefined =
          state.phase.name === 'PENDING_CLAIMS'
            ? seatsAwaitingClaimResponse(state)[0]
            : (currentSeat(state) ?? undefined);
        if (seat === undefined) break;
        const options = legalActions(state, seat);
        const winning = options.find(
          (a) => a.type === 'DECLARE_TODAS' || (a.type === 'CLAIM' && a.call === 'todas'),
        );
        const rng = createRng(`${state.seed}:${state.handNumber}:${state.history.length}:${seat}`);
        const decision = decide(publicView(state, seat), options, PERSONALITIES[LEVELS[seat]], rng);
        if (winning) expect(decision.action).toEqual(winning);
        state = reduce(state, decision.action);
      }
    }
  });
});
