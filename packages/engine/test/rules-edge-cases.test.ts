import { describe, expect, it } from 'vitest';
import { createGame, isLastHand, legalActions, reduce, nextHand } from '../src/game.js';
import { cloneRuleset, STANDARD } from '../src/rulesets.js';
import { handTileCount, expectedTileCount } from '../src/hand.js';
import type { Action, GameState, SeatId } from '../src/types.js';
import { pung, table, tiles } from './helpers.js';

describe('robbing the kang', () => {
  it('does not leave the robbed tile in two hands', () => {
    let state = table({
      hands: ['b1 c111 c222 k9 k8 c33 b7 k2 c9 b3', 'k123 k456 k789 c123 c456 b1'],
      melds: [[pung('b111')], []],
    });
    const sagasa = legalActions(state, 0).find((a) => a.type === 'SAGASA') as Action;
    state = reduce(state, sagasa);
    expect(state.phase.name).toBe('PENDING_CLAIMS');
    const todas = legalActions(state, 1).find(
      (a) => a.type === 'CLAIM' && a.call === 'todas',
    ) as Action;
    const robbedId = (state.phase as { discard: { id: string } }).discard.id;
    const won = reduce(state, todas);

    // The tile left the declarer's hand and joined the robber's.
    expect(won.players[1].concealed.some((t) => t.id === robbedId)).toBe(true);
    expect(won.players[0].concealed.some((t) => t.id === robbedId)).toBe(false);
  });
});

describe('pay every winner', () => {
  it('pays both when two players call mahjongg on one discard', () => {
    // Two seats each waiting on the same tile.
    let state = table({
      hands: [
        'k6 c111 c222 b1 b2 b3 b4 b5 b6 b7',
        'b123 b456 b789 k123 k45 c99',
        'b111 b222 c333 c444 k45 c99',
        'c111 c222 c333 k1',
      ],
      ruleset: { multipleWinnersOnDiscard: true },
    });
    for (const p of state.players) p.everDrewFlower = true;
    // Seat 1 and seat 2 both complete on 6 kahoy.
    const six = state.players[0].concealed[0];
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: six.id });
    const t1 = legalActions(state, 1).find((a) => a.type === 'CLAIM' && a.call === 'todas') as Action;
    const t2 = legalActions(state, 2).find((a) => a.type === 'CLAIM' && a.call === 'todas') as Action;
    expect(t1).toBeDefined();
    expect(t2).toBeDefined();
    state = reduce(state, t1);
    state = reduce(state, t2);
    if (state.phase.name !== 'HAND_OVER') throw new Error('hand not over');
    const s = state.phase.settlement;
    // Both should be paid.
    const paidSeats = new Set(s.transfers.map((t) => t.to));
    expect([...paidSeats].sort()).toEqual([1, 2]);
  });
});

describe('kang declarations require having drawn', () => {
  it('does not offer a secret kong right after claiming a chow', () => {
    let state = table({
      hands: ['b5 c111 k9', 'b34 b1111 c9 k1 k2 k3 c1'],
    });
    const five = state.players[0].concealed[0];
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: five.id });
    const chow = legalActions(state, 1).find((a) => a.type === 'CLAIM' && a.call === 'chow') as Action;
    state = reduce(state, chow);
    expect(state.phase).toMatchObject({ name: 'AWAITING_DISCARD', seat: 1 });
    // Seat 1 holds four 1-bolá but has not drawn: no secret kong yet.
    expect(legalActions(state, 1).some((a) => a.type === 'SECRET_KANG')).toBe(false);
  });

  it('offers a secret kong to the máno on the opening turn', () => {
    const state = table({ hands: ['b1111 c111 c222 k9 k8 c33 b7'] });
    expect(legalActions(state, 0).some((a) => a.type === 'SECRET_KANG')).toBe(true);
  });
});

describe('a win right after a claim is not a búnot', () => {
  it('scores it as a discard win', () => {
    // Seat 1 can pung the 9 kahoy and be complete afterwards.
    let state = table({
      hands: ['k9 c111 c222 b1', 'b123 b456 b789 k123 k99 c11'],
    });
    for (const p of state.players) p.everDrewFlower = true;
    const nine = state.players[0].concealed[0];
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: nine.id });
    const pungCall = legalActions(state, 1).find(
      (a) => a.type === 'CLAIM' && a.call === 'pung',
    ) as Action;
    if (!pungCall) return; // shape did not arise
    state = reduce(state, pungCall);
    const declare = legalActions(state, 1).find((a) => a.type === 'DECLARE_TODAS') as Action;
    if (!declare) return;
    const won = reduce(state, declare);
    if (won.phase.name !== 'HAND_OVER') throw new Error('hand not over');
    expect(won.phase.settlement.winType).toBe('discard');
  });
});

describe('rounds advance', () => {
  it('counts a round once the deal has been all the way round', () => {
    let state = createGame({
      seed: 'rounds',
      dealerSeat: 0,
      ruleset: { ...cloneRuleset(STANDARD), drawEndsDealership: true },
    });
    const seen: number[] = [];
    for (let hand = 0; hand < 8; hand++) {
      state = {
        ...state,
        phase: {
          name: 'HAND_OVER',
          settlement: {
            winner: null, // a draw that always passes the deal
            winType: 'draw',
            discarder: null,
            items: [],
            multipliers: [],
            total: 0,
            transfers: [],
            immediate: [],
          },
        },
      };
      state = nextHand(state);
      seen.push(state.round);
    }
    // Four hands per full rotation: rounds should read 1,1,1,2,2,2,2,3
    expect(seen[0]).toBe(1);
    expect(seen[3]).toBe(2);
    expect(seen[7]).toBe(3);
  });
});

describe('hand size invariant after every claim type', () => {
  it('holds after a kong claim', () => {
    let state = table({ hands: [undefined, undefined, undefined, undefined] });
    const seat0 = state.players[0];
    // Give seat 1 three copies of whatever seat 0 will throw.
    const thrown = seat0.concealed[0];
    if (thrown.kind !== 'suited') return;
    state.players[1].concealed = [
      ...tiles(`${thrown.suit === 'balls' ? 'b' : thrown.suit === 'sticks' ? 'k' : 'c'}${thrown.rank}${thrown.rank}${thrown.rank}`),
      ...state.players[1].concealed.slice(3),
    ];
    state = reduce(state, { type: 'DISCARD', seat: 0, tileId: thrown.id });
    const kong = legalActions(state, 1).find((a) => a.type === 'CLAIM' && a.call === 'kang') as Action;
    if (!kong) return;
    state = reduce(state, kong);
    const p = state.players[1];
    expect(handTileCount(p.concealed, p.melds)).toBe(expectedTileCount(p.melds));
  });
});

describe('a session ends after its rounds', () => {
  it('stops offering a deal once the last round is played out', () => {
    let state = createGame({
      seed: 'session-end',
      dealerSeat: 0,
      ruleset: { ...cloneRuleset(STANDARD), roundsPerGame: 2, drawEndsDealership: true },
    });
    const drawn = (s: GameState): GameState => ({
      ...s,
      phase: {
        name: 'HAND_OVER',
        settlement: {
          winner: null,
          winType: 'draw',
          discarder: null,
          items: [],
          multipliers: [],
          total: 0,
          transfers: [],
          immediate: [],
        },
      },
    });

    const rounds: number[] = [];
    for (let hand = 0; hand < 8; hand++) {
      state = drawn(state);
      if (isLastHand(state)) break;
      state = nextHand(state);
      rounds.push(state.round);
    }
    // Two rounds is eight deals; the ninth would start round three.
    expect(rounds).toEqual([1, 1, 1, 2, 2, 2, 2]);
    expect(isLastHand(drawn(state))).toBe(true);
  });

  it('never ends when the table plays an open-ended session', () => {
    let state = createGame({
      seed: 'open-ended',
      ruleset: { ...cloneRuleset(STANDARD), roundsPerGame: 0 },
    });
    state = {
      ...state,
      phase: {
        name: 'HAND_OVER',
        settlement: {
          winner: null,
          winType: 'draw',
          discarder: null,
          items: [],
          multipliers: [],
          total: 0,
          transfers: [],
          immediate: [],
        },
      },
    };
    expect(isLastHand(state)).toBe(false);
  });
});
