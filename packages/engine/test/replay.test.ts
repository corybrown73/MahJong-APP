import { describe, expect, it } from 'vitest';
import {
  createGame,
  currentSeat,
  handInvariantHolds,
  legalActions,
  nextHand,
  reduce,
  seatsAwaitingClaimResponse,
} from '../src/game.js';
import { createRng } from '../src/rng.js';
import type { Action, GameState } from '../src/types.js';

/**
 * A deterministic scripted player, used to record golden replays. It is
 * deliberately dumb — the point is that the same seed produces the same game,
 * byte for byte.
 */
function scriptedGame(seed: string, maxSteps = 4000): { state: GameState; history: Action[] } {
  const rng = createRng(`script:${seed}`);
  let state = createGame({ seed });
  let steps = 0;

  while (state.phase.name !== 'HAND_OVER' && steps++ < maxSteps) {
    if (state.phase.name === 'PENDING_CLAIMS') {
      const seat = seatsAwaitingClaimResponse(state)[0];
      if (seat === undefined) throw new Error('claim window stuck with nobody to respond');
      const options = legalActions(state, seat);
      const todas = options.find((a) => a.type === 'CLAIM' && a.call === 'todas');
      const other = options.find((a) => a.type === 'CLAIM');
      const takeIt = rng.next() < 0.5;
      state = reduce(state, todas ?? (takeIt && other ? other : { type: 'PASS', seat }));
      continue;
    }

    const seat = currentSeat(state);
    if (seat === null) throw new Error(`stuck in phase ${state.phase.name}`);
    const options = legalActions(state, seat);
    const todas = options.find((a) => a.type === 'DECLARE_TODAS');
    const draw = options.find((a) => a.type === 'DRAW');
    const kang = options.find((a) => a.type === 'SECRET_KANG' || a.type === 'SAGASA');
    const discards = options.filter((a) => a.type === 'DISCARD');

    if (todas) state = reduce(state, todas);
    else if (draw) state = reduce(state, draw);
    else if (kang && rng.next() < 0.6) state = reduce(state, kang);
    else if (discards.length > 0) state = reduce(state, discards[rng.int(discards.length)]);
    else throw new Error(`no legal action for seat ${seat} in ${state.phase.name}`);
  }

  return { state, history: state.history };
}

function fingerprint(state: GameState): string {
  return JSON.stringify({
    phase: state.phase,
    chips: state.players.map((p) => p.chips),
    discards: state.discards.map((d) => `${d.from}:${d.tile.id}${d.claimed ? '*' : ''}`),
    melds: state.players.map((p) => p.melds.map((m) => m.tiles.map((t) => t.id).join('+'))),
    drawnFromWall: state.drawnFromWall,
    giftsDrawn: state.giftsDrawn,
  });
}

describe('golden replays', () => {
  it('replays identically from the same seed', () => {
    for (const seed of ['golden-1', 'golden-2', 'golden-3']) {
      const first = scriptedGame(seed);
      const second = scriptedGame(seed);
      expect(second.history).toEqual(first.history);
      expect(fingerprint(second.state)).toBe(fingerprint(first.state));
    }
  });

  it('replays identically when the recorded actions are fed back in', () => {
    const { state: original, history } = scriptedGame('golden-replay');
    let replayed = createGame({ seed: 'golden-replay' });
    for (const action of history) replayed = reduce(replayed, action);
    expect(fingerprint(replayed)).toBe(fingerprint(original));
  });

  it('produces a different game for a different seed', () => {
    expect(fingerprint(scriptedGame('golden-a').state)).not.toBe(
      fingerprint(scriptedGame('golden-b').state),
    );
  });
});

describe('invariants hold through complete hands', () => {
  it('never breaks the hand-size invariant or loses a tile, over 60 hands', () => {
    for (let i = 0; i < 60; i++) {
      const seed = `invariant-${i}`;
      let state = createGame({ seed });
      const rng = createRng(`invariant-script-${i}`);
      let steps = 0;

      while (state.phase.name !== 'HAND_OVER' && steps++ < 4000) {
        expect(handInvariantHolds(state)).toBe(true);

        // A claimed discard stays in the pool (so the player can reconstruct
        // the hand) while also living in the caller's meld, so it is counted
        // twice here and subtracted back out.
        const claimed = state.discards.filter((d) => d.claimed).length;
        const held =
          state.players.reduce(
            (n, p) =>
              n +
              p.concealed.length +
              p.flowers.length +
              p.melds.reduce((m, meld) => m + meld.tiles.length, 0),
            0,
          ) +
          state.discards.length -
          claimed;
        expect(held).toBe(state.drawnFromWall + state.giftsDrawn);

        if (state.phase.name === 'PENDING_CLAIMS') {
          const seat = seatsAwaitingClaimResponse(state)[0];
          const options = legalActions(state, seat);
          const claim = options.find((a) => a.type === 'CLAIM');
          state = reduce(state, claim && rng.next() < 0.4 ? claim : { type: 'PASS', seat });
          continue;
        }
        const seat = currentSeat(state)!;
        const options = legalActions(state, seat);
        const todas = options.find((a) => a.type === 'DECLARE_TODAS');
        const draw = options.find((a) => a.type === 'DRAW');
        const discards = options.filter((a) => a.type === 'DISCARD');
        if (todas) state = reduce(state, todas);
        else if (draw) state = reduce(state, draw);
        else state = reduce(state, discards[rng.int(discards.length)]);
      }

      expect(state.phase.name).toBe('HAND_OVER');
    }
  });

  it('settles every hand to a zero-sum table', () => {
    for (let i = 0; i < 25; i++) {
      const { state } = scriptedGame(`zero-sum-${i}`);
      const total = state.players.reduce((n, p) => n + p.chips, 0);
      expect(Math.abs(total)).toBeLessThan(1e-9);
    }
  });

  it('plays a full four-hand session without getting stuck', () => {
    let state = scriptedGame('session').state;
    for (let hand = 0; hand < 4; hand++) {
      expect(state.phase.name).toBe('HAND_OVER');
      const chipsBefore = state.players.reduce((n, p) => n + p.chips, 0);
      state = nextHand(state);
      // Chips carry over; the new deal may already have paid an immediate
      // ambition, but the table stays zero-sum.
      expect(Math.abs(state.players.reduce((n, p) => n + p.chips, 0) - chipsBefore)).toBeLessThan(
        1e-9,
      );
      const seed = state.seed;
      const handNumber = state.handNumber;
      // Continue playing this hand out with the same scripted policy.
      const rng = createRng(`session-${handNumber}`);
      let steps = 0;
      while (state.phase.name !== 'HAND_OVER' && steps++ < 4000) {
        if (state.phase.name === 'PENDING_CLAIMS') {
          const seat = seatsAwaitingClaimResponse(state)[0];
          const options = legalActions(state, seat);
          const todas = options.find((a) => a.type === 'CLAIM' && a.call === 'todas');
          state = reduce(state, todas ?? { type: 'PASS', seat });
          continue;
        }
        const seat = currentSeat(state)!;
        const options = legalActions(state, seat);
        const todas = options.find((a) => a.type === 'DECLARE_TODAS');
        const draw = options.find((a) => a.type === 'DRAW');
        const discards = options.filter((a) => a.type === 'DISCARD');
        if (todas) state = reduce(state, todas);
        else if (draw) state = reduce(state, draw);
        else state = reduce(state, discards[rng.int(discards.length)]);
      }
      expect(state.seed).toBe(seed);
    }
  });
});
