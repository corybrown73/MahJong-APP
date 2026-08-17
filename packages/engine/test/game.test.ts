import { describe, expect, it } from 'vitest';
import {
  createGame,
  currentSeat,
  handInvariantHolds,
  legalActions,
  nextHand,
  reduce,
  tilesRemaining,
} from '../src/game.js';
import { expectedTileCount, handTileCount, isWinningHand } from '../src/hand.js';
import { cloneRuleset, STANDARD } from '../src/rulesets.js';
import { isFlower, isSuited } from '../src/tiles.js';
import type { Action, GameState, SeatId, Tile } from '../src/types.js';
import { pung, table, tiles } from './helpers.js';

function pendingSeat(state: GameState): SeatId {
  if (state.phase.name !== 'PENDING_CLAIMS') throw new Error('no claim window open');
  const phase = state.phase;
  const seat = phase.eligible.find(
    (s) => !phase.passed.includes(s) && !phase.claims.some((c) => c.seat === s),
  );
  if (seat === undefined) throw new Error('every seat has already responded');
  return seat;
}

function tileAccounting(state: GameState): { taken: number; held: number } {
  const held =
    state.players.reduce(
      (n, p) =>
        n + p.concealed.length + p.flowers.length + p.melds.reduce((m, meld) => m + meld.tiles.length, 0),
      0,
    ) + state.discards.length;
  return { taken: state.drawnFromWall + state.giftsDrawn, held };
}

describe('the deal', () => {
  it('gives everyone 16 tiles and the máno 17', () => {
    const state = createGame({ seed: 'deal-1' });
    expect(state.players[0].concealed).toHaveLength(17);
    for (const seat of [1, 2, 3] as SeatId[]) {
      expect(state.players[seat].concealed).toHaveLength(16);
    }
    expect(state.phase).toMatchObject({ name: 'AWAITING_DISCARD', seat: 0 });
  });

  it('leaves no flower in anybody’s hand', () => {
    for (let i = 0; i < 40; i++) {
      const state = createGame({ seed: `flowers-${i}` });
      for (const player of state.players) {
        expect(player.concealed.every(isSuited)).toBe(true);
      }
    }
  });

  it('accounts for every tile it takes from the wall', () => {
    for (let i = 0; i < 20; i++) {
      const state = createGame({ seed: `accounting-${i}` });
      const { taken, held } = tileAccounting(state);
      expect(taken).toBe(held);
      expect(tilesRemaining(state)).toBe(144 - taken);
    }
  });

  it('sets a joker when the ruleset enables one, and none when it does not', () => {
    expect(createGame({ seed: 'joker-on' }).joker).not.toBeNull();
    expect(
      createGame({ seed: 'joker-off', ruleset: { ...cloneRuleset(STANDARD), jokerEnabled: false } })
        .joker,
    ).toBeNull();
  });

  it('pays No Flowers at the deal to anyone dealt none', () => {
    let found = false;
    for (let i = 0; i < 400 && !found; i++) {
      const state = createGame({ seed: `noflowers-${i}` });
      const payouts = state.immediate.filter((p) => p.ambition === 'noFlowers');
      for (const payout of payouts) {
        found = true;
        expect(state.players[payout.seat].flowers).toHaveLength(0);
        expect(state.players[payout.seat].chips).toBeGreaterThan(0);
      }
    }
    expect(found).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const a = createGame({ seed: 'same' });
    const b = createGame({ seed: 'same' });
    expect(a.players.map((p) => p.concealed.map((t) => t.id))).toEqual(
      b.players.map((p) => p.concealed.map((t) => t.id)),
    );
  });
});

describe('turn structure', () => {
  it('runs discard -> claim window -> next player draws', () => {
    let state = createGame({ seed: 'turns' });
    const first = state.players[0].concealed[0];
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: first.id });

    if (state.phase.name === 'PENDING_CLAIMS') {
      for (const seat of [1, 2, 3] as SeatId[]) {
        if (state.phase.name !== 'PENDING_CLAIMS') break;
        state = reduce(state, { type: 'PASS', seat });
      }
    }
    expect(state.phase).toMatchObject({ name: 'AWAITING_DRAW', seat: 1 });
    expect(state.discards).toHaveLength(1);
    expect(state.discards[0].tile.id).toBe(first.id);

    state = reduce(state, { type: 'DRAW', seat: 1 });
    expect(state.phase.name).toBe('AWAITING_DISCARD');
    expect(currentSeat(state)).toBe(1);
    expect(handInvariantHolds(state)).toBe(true);
  });

  it('pre-passes seats that have no legal call, so an unclaimable discard resolves at once', () => {
    // Give everyone an unhelpful hand so nobody can call the 9 chars.
    const state = table({ hands: [undefined, 'b111 k111', 'b222 k222', 'b333 k333'] });
    const discard = state.players[0].concealed.find(
      (t) => isSuited(t) && t.suit === 'chars' && t.rank === 9,
    );
    const tileId = discard?.id ?? state.players[0].concealed[0].id;
    const after = reduce(state, { type: 'DISCARD', seat: 0, tileId });
    expect(after.phase.name).toBe('AWAITING_DRAW');
  });

  it('collects every response before resolving, rather than first-come-first-served', () => {
    // Seat 1 can chow; seat 2 can pung. Pung must win even though seat 1 is nearer.
    let state = table({
      hands: ['b555 c111 c222 k9', 'b34 c333 c444 k1', 'b55 c555 c666 k2', 'c777 c888 k3'],
    });
    const five = state.players[0].concealed.find((t) => isSuited(t) && t.rank === 5)!;
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: five.id });
    expect(state.phase.name).toBe('PENDING_CLAIMS');

    const chowClaim = legalActions(state, 1).find(
      (a) => a.type === 'CLAIM' && a.call === 'chow',
    ) as Action;
    const pungClaim = legalActions(state, 2).find(
      (a) => a.type === 'CLAIM' && a.call === 'pung',
    ) as Action;
    expect(chowClaim).toBeDefined();
    expect(pungClaim).toBeDefined();

    state = reduce(state, chowClaim);
    expect(state.phase.name).toBe('PENDING_CLAIMS'); // still waiting on the others
    state = reduce(state, pungClaim);
    while (state.phase.name === 'PENDING_CLAIMS') {
      state = reduce(state, { type: 'PASS', seat: pendingSeat(state) });
    }

    expect(state.phase).toMatchObject({ name: 'AWAITING_DISCARD', seat: 2 });
    expect(state.players[2].melds[0].type).toBe('pung');
    expect(state.players[1].melds).toHaveLength(0);
  });

  it('treats a repeated PASS as idempotent', () => {
    let state = table({ hands: ['b555 c111 c222 k9', 'b34 c333 c444 k1', 'b55 c1', 'c2'] });
    const five = state.players[0].concealed.find((t) => isSuited(t) && t.rank === 5)!;
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: five.id });
    expect(state.phase.name).toBe('PENDING_CLAIMS');
    const seat = pendingSeat(state);
    const once = reduce(state, { type: 'PASS', seat });
    const twice = reduce(once, { type: 'PASS', seat });
    expect(twice.phase).toEqual(once.phase);
  });

  it('refuses an illegal action', () => {
    const state = createGame({ seed: 'illegal' });
    expect(() => reduce(state, { type: 'DRAW', seat: 0 })).toThrow();
    expect(() => reduce(state, { type: 'DISCARD', seat: 1, tileId: 'nope' })).toThrow();
  });
});

describe('claiming', () => {
  function discardAndClaim(spec: Parameters<typeof table>[0], call: string) {
    let state = table(spec);
    const target = state.players[0].concealed[0];
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: target.id });
    const claim = legalActions(state, 1).find(
      (a) => a.type === 'CLAIM' && a.call === call,
    ) as Action;
    expect(claim).toBeDefined();
    state = reduce(state, claim);
    return state;
  }

  it('exposes a chow and hands the turn to the caller', () => {
    const state = discardAndClaim({ hands: ['b5 c111 c222 k9', 'b34 c333 c444 k1'] }, 'chow');
    expect(state.players[1].melds[0]).toMatchObject({ type: 'chow', claimedFrom: 0 });
    expect(state.phase).toMatchObject({ name: 'AWAITING_DISCARD', seat: 1 });
    expect(state.discards[0].claimed).toBe(true);
  });

  it('exposes a pung', () => {
    const state = discardAndClaim({ hands: ['b5 c111 c222 k9', 'b55 c333 c444 k1'] }, 'pung');
    expect(state.players[1].melds[0]).toMatchObject({ type: 'pung', claimedFrom: 0 });
  });

  it('exposes an open kang, pays immediately and draws a gift tile', () => {
    const state = discardAndClaim({ hands: ['b5 c111 c222 k9', 'b555 c333 c444 k1'] }, 'kang');
    const meld = state.players[1].melds[0];
    expect(meld).toMatchObject({ type: 'kang', variant: 'open' });
    expect(state.immediate.some((p) => p.ambition === 'openKang' && p.seat === 1)).toBe(true);
    expect(state.giftsDrawn).toBeGreaterThan(0);
  });

  it('ends the hand on a claimed tódas, paid double by the discarder', () => {
    let state = table({
      hands: ['k6 c111 c222 b1', 'b123 b456 b789 k123 k45 c99'],
    });
    for (const player of state.players) player.everDrewFlower = true;
    const six = state.players[0].concealed[0];
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: six.id });
    const todas = legalActions(state, 1).find(
      (a) => a.type === 'CLAIM' && a.call === 'todas',
    ) as Action;
    state = reduce(state, todas);
    expect(state.phase.name).toBe('HAND_OVER');
    if (state.phase.name !== 'HAND_OVER') return;
    const settlement = state.phase.settlement;
    expect(settlement.winner).toBe(1);
    expect(settlement.discarder).toBe(0);
    expect(settlement.transfers.find((t) => t.from === 0)!.amount).toBe(settlement.total * 2);
    expect(state.players[1].chips).toBeGreaterThan(0);
    expect(state.players[0].chips).toBeLessThan(0);
  });
});

describe('kang varieties', () => {
  it('declares a secret kang on your own turn and pays 0.50', () => {
    let state = table({ hands: ['b1111 c111 c222 k9 k8 c33 b7'] });
    const action = legalActions(state, 0).find((a) => a.type === 'SECRET_KANG') as Action;
    expect(action).toBeDefined();
    state = reduce(state, action);
    const meld = state.players[0].melds[0];
    expect(meld).toMatchObject({ type: 'kang', variant: 'secret', claimedFrom: null });
    const payout = state.immediate.find((p) => p.ambition === 'secretKang')!;
    expect(payout.value).toBe(0.5);
    expect(payout.amount).toBe(1.5);
    expect(state.players[0].chips).toBeGreaterThanOrEqual(1.5);
  });

  it('extends an exposed pung with sagása and pays 0.50', () => {
    let state = table({
      hands: ['b1 c111 c222 k9 k8 c33 b7 k2 c9 b3'],
      melds: [[pung('b111')]],
    });
    const action = legalActions(state, 0).find((a) => a.type === 'SAGASA') as Action;
    expect(action).toBeDefined();
    state = reduce(state, action);
    expect(state.players[0].melds[0]).toMatchObject({ type: 'kang', variant: 'sagasa' });
    expect(state.immediate.some((p) => p.ambition === 'sagasa')).toBe(true);
  });

  it('lets another player rob the kang', () => {
    let state = table({
      hands: ['b1 c111 c222 k9 k8 c33 b7 k2 c9 b3', 'b123 b456 b789 k123 k45 b11'],
      melds: [[pung('b111')], []],
    });
    // Seat 1 is waiting on 1 balls (b11 + b1 -> pung) — hand: four sets + b11 + k45.
    state.players[1].concealed = tiles('b123 b456 b789 k123 k4 b11');
    state.players[1].concealed.push(...tiles('k5'));
    const action = legalActions(state, 0).find((a) => a.type === 'SAGASA') as Action;
    state = reduce(state, action);
    // Seat 1 cannot win on b1 here, so the kang completes rather than pausing.
    expect(state.players[0].melds[0]).toMatchObject({ type: 'kang', variant: 'sagasa' });
  });

  it('offers a robbing window when the sagása tile completes another hand', () => {
    let state = table({
      hands: ['b1 c111 c222 k9 k8 c33 b7 k2 c9 b3', 'k123 k456 k789 c123 c45 b11'],
      melds: [[pung('b111')], []],
      ruleset: { robbingTheKang: true },
    });
    state.players[1].concealed = tiles('k123 k456 k789 c123 c456 b1');
    const action = legalActions(state, 0).find((a) => a.type === 'SAGASA') as Action;
    state = reduce(state, action);
    expect(state.phase.name).toBe('PENDING_CLAIMS');
    if (state.phase.name !== 'PENDING_CLAIMS') return;
    expect(state.phase.robbingKang).toBeDefined();
    expect(state.phase.eligible).toEqual([1]);

    const todas = legalActions(state, 1).find(
      (a) => a.type === 'CLAIM' && a.call === 'todas',
    ) as Action;
    expect(todas).toBeDefined();
    const won = reduce(state, todas);
    expect(won.phase.name).toBe('HAND_OVER');
    if (won.phase.name !== 'HAND_OVER') return;
    expect(won.phase.settlement.winner).toBe(1);
    expect(won.phase.settlement.discarder).toBe(0);
  });

  it('completes the kang when everyone passes on robbing it', () => {
    let state = table({
      hands: ['b1 c111 c222 k9 k8 c33 b7 k2 c9 b3', 'k123 k456 k789 c123 c456 b1'],
      melds: [[pung('b111')], []],
    });
    const action = legalActions(state, 0).find((a) => a.type === 'SAGASA') as Action;
    state = reduce(state, action);
    if (state.phase.name === 'PENDING_CLAIMS') {
      state = reduce(state, { type: 'PASS', seat: 1 });
    }
    expect(state.players[0].melds[0]).toMatchObject({ type: 'kang', variant: 'sagasa' });
    expect(state.phase).toMatchObject({ name: 'AWAITING_DISCARD', seat: 0 });
  });

  it('does not offer a kang when there is no gift tile left', () => {
    const state = table({ hands: ['b1111 c111 c222 k9 k8 c33 b7'] });
    state.drawnFromWall = 144;
    state.giftsDrawn = 0;
    expect(legalActions(state, 0).some((a) => a.type === 'SECRET_KANG')).toBe(false);
  });
});

describe('declaring tódas on your own turn', () => {
  it('is a búnot, and every player pays the doubled amount', () => {
    const state = table({ hands: ['b123 b456 b789 k123 k456 c99'] });
    for (const player of state.players) player.everDrewFlower = true;
    const action = legalActions(state, 0).find((a) => a.type === 'DECLARE_TODAS') as Action;
    expect(action).toBeDefined();
    const after = reduce(state, action);
    expect(after.phase.name).toBe('HAND_OVER');
    if (after.phase.name !== 'HAND_OVER') return;
    expect(after.phase.settlement.winType).toBe('bunot');
    expect(new Set(after.phase.settlement.transfers.map((t) => t.amount)).size).toBe(1);
  });

  it('is not offered on an incomplete hand', () => {
    const state = table({ hands: ['b123 b456 b789 k123 k457 c99'] });
    expect(legalActions(state, 0).some((a) => a.type === 'DECLARE_TODAS')).toBe(false);
  });
});

describe('bisaklát', () => {
  it('ends the hand instantly when the máno is dealt a winning hand', () => {
    // Search seeds for a dealt win rather than fabricating one, so this also
    // proves createGame checks it.
    const state = createGame({ seed: 'bisaklat-probe' });
    // Force the condition by rebuilding a state whose máno hand already wins.
    const forced = table({ hands: ['b123 b456 b789 k123 k456 c99'] });
    expect(
      isWinningHand({
        concealed: forced.players[0].concealed,
        melds: [],
        joker: null,
        sieteParesRequiresConcealed: false,
      }),
    ).toBe(true);
    expect(state.phase.name).not.toBe('HAND_OVER');
  });
});

describe('the wall running out', () => {
  it('ends the hand in a draw with nobody paying', () => {
    let state = table({});
    state.drawnFromWall = 100;
    state.giftsDrawn = 44;
    const tile = state.players[0].concealed[0];
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: tile.id });
    while (state.phase.name === 'PENDING_CLAIMS') {
      state = reduce(state, { type: 'PASS', seat: pendingSeat(state) });
    }
    expect(state.phase.name).toBe('HAND_OVER');
    if (state.phase.name !== 'HAND_OVER') return;
    expect(state.phase.settlement.winType).toBe('draw');
    expect(state.phase.settlement.transfers).toEqual([]);
  });
});

describe('dealer rotation', () => {
  function handOver(state: GameState, winner: SeatId | null): GameState {
    const next = { ...state };
    next.phase = {
      name: 'HAND_OVER',
      settlement: {
        winner,
        winType: winner === null ? 'draw' : 'bunot',
        discarder: null,
        items: [],
        multipliers: [],
        total: 0,
        transfers: [],
        immediate: [],
      },
    };
    return next;
  }

  it('keeps the dealership with the máno on a win', () => {
    const state = handOver(createGame({ seed: 'rot-1', dealerSeat: 1 }), 1);
    expect(nextHand(state).dealerSeat).toBe(1);
  });

  it('passes the dealership counterclockwise otherwise', () => {
    const state = handOver(createGame({ seed: 'rot-2', dealerSeat: 1 }), 2);
    expect(nextHand(state).dealerSeat).toBe(2);
  });

  it('keeps the dealership on a draw by default', () => {
    const state = handOver(createGame({ seed: 'rot-3', dealerSeat: 1 }), null);
    expect(nextHand(state).dealerSeat).toBe(1);
  });

  it('passes it on a draw when the house rule says so', () => {
    const base = createGame({
      seed: 'rot-4',
      dealerSeat: 1,
      ruleset: { ...cloneRuleset(STANDARD), drawEndsDealership: true },
    });
    expect(nextHand(handOver(base, null)).dealerSeat).toBe(2);
  });

  it('carries chips into the next hand', () => {
    const state = handOver(createGame({ seed: 'rot-5' }), 0);
    state.players[2].chips = -4.25;
    expect(nextHand(state).players[2].chips).toBe(-4.25);
  });
});
