import { describe, expect, it } from 'vitest';
import {
  createGame,
  currentSeat,
  handInvariantHolds,
  legalActions,
  reduce,
  seatsAwaitingClaimResponse,
} from '../src/game.js';
import { createRng } from '../src/rng.js';
import type { Action, GameState } from '../src/types.js';

function allTiles(state: GameState) {
  const out: string[] = [];
  for (const p of state.players) {
    for (const t of p.concealed) out.push(t.id);
    for (const f of p.flowers) out.push(f.id);
    for (const m of p.melds) for (const t of m.tiles) out.push(t.id);
  }
  for (const d of state.discards) if (!d.claimed) out.push(d.tile.id);
  return out;
}

/** A kang-hungry policy: maximises gift draws, which is how the wall runs dry. */
function fuzz(seed: string) {
  const rng = createRng(`fuzz:${seed}`);
  let state = createGame({ seed });
  let steps = 0;
  while (state.phase.name !== 'HAND_OVER' && steps++ < 6000) {
    expect(handInvariantHolds(state)).toBe(true);
    const ids = allTiles(state);
    expect(new Set(ids).size).toBe(ids.length);

    let seat: number;
    let action: Action;
    if (state.phase.name === 'PENDING_CLAIMS') {
      seat = seatsAwaitingClaimResponse(state)[0];
      expect(seat).toBeDefined();
      const options = legalActions(state, seat as 0);
      const kang = options.find((a) => a.type === 'CLAIM' && a.call === 'kang');
      const todas = options.find((a) => a.type === 'CLAIM' && a.call === 'todas');
      const any = options.find((a) => a.type === 'CLAIM');
      action = todas ?? kang ?? (rng.next() < 0.35 && any ? any : { type: 'PASS', seat: seat as 0 });
    } else {
      const s = currentSeat(state);
      if (s === null) throw new Error(`stuck in ${state.phase.name}`);
      seat = s;
      const options = legalActions(state, s);
      const todas = options.find((a) => a.type === 'DECLARE_TODAS');
      const draw = options.find((a) => a.type === 'DRAW');
      const kang = options.find((a) => a.type === 'SECRET_KANG' || a.type === 'SAGASA');
      const discards = options.filter((a) => a.type === 'DISCARD');
      action = todas ?? draw ?? kang ?? discards[rng.int(discards.length)];
      if (!action) throw new Error(`no legal action for ${seat} in ${state.phase.name}`);
    }
    // Everything we dispatch must have been offered.
    expect(legalActions(state, seat as 0)).toContainEqual(action);
    state = reduce(state, action);
  }
  expect(state.phase.name).toBe('HAND_OVER');

  // The winner ends holding the extra tile, so the mid-play invariant only
  // applies to a hand that ended with nobody winning.
  if (state.phase.name === 'HAND_OVER' && state.phase.settlement.winType === 'draw') {
    expect(handInvariantHolds(state)).toBe(true);
  }
  const ids = allTiles(state);
  expect(new Set(ids).size).toBe(ids.length);
  const total = state.players.reduce((n, p) => n + p.chips, 0);
  expect(Math.abs(total)).toBeLessThan(1e-9);
  return state;
}

describe('kang-hungry fuzz', () => {
  it('survives 150 hands that draw every gift tile they can', () => {
    let exhausted = 0;
    for (let i = 0; i < 150; i++) {
      const state = fuzz(`kang-${i}`);
      if (state.phase.name === 'HAND_OVER' && state.phase.settlement.winType === 'draw') {
        exhausted++;
      }
    }
    // Sanity: the policy really is reaching wall exhaustion sometimes.
    expect(exhausted).toBeGreaterThan(0);
  });
});

describe('the wall runs dry while drawing a gift', () => {
  it('ends the hand rather than leaving a short hand on the table', async () => {
    const { table, tiles } = await import('./helpers.js');
    const state = table({ hands: ['b1111 c111 c222 k9 k8 c33 b7'] });
    // Leave exactly one tile, and make it a flower so the replacement chain
    // runs off the end of the wall.
    state.drawnFromWall = 143;
    state.giftsDrawn = 0;
    state.wall[state.flowerIndex] = {
      kind: 'flower',
      group: 'wind',
      face: 'east',
      id: 'flower-forced',
    };
    const kong = legalActions(state, 0).find((a) => a.type === 'SECRET_KANG')!;
    expect(kong).toBeDefined();
    const after = reduce(state, kong);
    // Either the hand is over, or seat 0 still holds a legal hand to discard from.
    if (after.phase.name !== 'HAND_OVER') {
      expect(handInvariantHolds(after)).toBe(true);
    }
  });
});

describe('the view keeps one seat’s tiles to itself', () => {
  it('hides the tile another seat just drew', async () => {
    const { publicView } = await import('../src/view.js');
    const { table } = await import('./helpers.js');
    const state = table({});
    expect(state.phase.name).toBe('AWAITING_DISCARD');
    const mine = publicView(state, 0);
    const theirs = publicView(state, 1);
    if (mine.phase.name !== 'AWAITING_DISCARD' || theirs.phase.name !== 'AWAITING_DISCARD') {
      throw new Error('not a discard phase');
    }
    expect(mine.phase.justDrew).not.toBeNull();
    expect(theirs.phase.justDrew).toBeNull();
    // And nothing anywhere in another seat's view names a tile they hold.
    const serialised = JSON.stringify(theirs);
    for (const tile of state.players[0].concealed) {
      expect(serialised).not.toContain(tile.id);
    }
  });

  it('hides which tiles another seat committed to a claim', async () => {
    const { publicView } = await import('../src/view.js');
    const { table } = await import('./helpers.js');
    // Two seats can call the 5 bolá, so the window stays open after the first.
    let state = table({
      hands: ['b5 c111 k9', 'b34 b1111 c9 k1 k2 k3 c1', 'b67 c222 k5'],
      ruleset: { chowFromAnyPlayer: true },
    });
    const five = state.players[0].concealed[0];
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: five.id });
    const chow = legalActions(state, 1).find((a) => a.type === 'CLAIM')!;
    state = reduce(state, chow);
    if (state.phase.name !== 'PENDING_CLAIMS') throw new Error('window closed early');
    const theirs = publicView(state, 2);
    if (theirs.phase.name !== 'PENDING_CLAIMS') throw new Error('window closed early');
    expect(theirs.phase.claims[0].tileIds).toEqual([]);
    const mine = publicView(state, 1);
    if (mine.phase.name !== 'PENDING_CLAIMS') throw new Error('window closed early');
    expect(mine.phase.claims[0].tileIds.length).toBeGreaterThan(0);
  });
});

describe('the settlement reveals the winning hand', () => {
  it('carries the winner’s tiles for every kind of win', async () => {
    const { createRng } = await import('../src/rng.js');
    let revealed = 0;
    for (let i = 0; i < 40; i++) {
      let state = createGame({ seed: `reveal-${i}` });
      const rng = createRng(`reveal-script-${i}`);
      let steps = 0;
      while (state.phase.name !== 'HAND_OVER' && steps++ < 6000) {
        const seat =
          state.phase.name === 'PENDING_CLAIMS'
            ? seatsAwaitingClaimResponse(state)[0]
            : currentSeat(state);
        if (seat === null || seat === undefined) break;
        const options = legalActions(state, seat);
        const win = options.find(
          (a) => a.type === 'DECLARE_TODAS' || (a.type === 'CLAIM' && a.call === 'todas'),
        );
        const draw = options.find((a) => a.type === 'DRAW');
        const claim = options.find((a) => a.type === 'CLAIM');
        const discards = options.filter((a) => a.type === 'DISCARD');
        const pass = options.find((a) => a.type === 'PASS');
        state = reduce(
          state,
          win ??
            draw ??
            (claim && rng.next() < 0.4 ? claim : (pass ?? discards[rng.int(discards.length)])),
        );
      }
      if (state.phase.name !== 'HAND_OVER') continue;
      const settlement = state.phase.settlement;
      if (settlement.winner === null) {
        expect(settlement.winnerHand).toBeUndefined();
        continue;
      }
      revealed++;
      const hand = settlement.winnerHand;
      expect(hand).toBeDefined();
      // Seventeen tiles, plus the extra tile each kang carries.
      const total =
        hand!.concealed.length + hand!.melds.reduce((n, m) => n + m.tiles.length, 0);
      expect(total).toBe(17 + hand!.melds.filter((m) => m.type === 'kang').length);
    }
    expect(revealed).toBeGreaterThan(0);
  });
});
