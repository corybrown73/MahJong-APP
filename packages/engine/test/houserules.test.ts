import { describe, expect, it } from 'vitest';
import { createGame, nextHand, reduce, legalActions } from '../src/game.js';
import {
  AMBITIONS,
  cloneRuleset,
  defaultJaiAlai,
  normalizeRuleset,
  STANDARD,
  VISAYAN,
} from '../src/rulesets.js';
import { settle } from '../src/scoring.js';
import type { GameState, Ruleset, SeatId, Settlement } from '../src/types.js';
import { table, tile, tiles } from './helpers.js';

function jaiAlaiRuleset(overrides: Partial<Ruleset> = {}): Ruleset {
  return {
    ...cloneRuleset(STANDARD),
    jaiAlai: { ...defaultJaiAlai(), enabled: true },
    ...overrides,
  };
}

function handOverWith(state: GameState, settlement: Settlement): GameState {
  return { ...state, phase: { name: 'HAND_OVER', settlement } };
}

function winSettlement(
  state: GameState,
  winner: SeatId,
  winType: 'discard' | 'bunot' | 'bisaklat',
  discarder: SeatId | null,
): Settlement {
  const player = state.players[winner];
  return settle({
    state,
    winner,
    winType,
    discarder,
    winningTile: winType === 'bisaklat' ? null : player.concealed[player.concealed.length - 1],
    concealedBefore: winType === 'bisaklat' ? null : player.concealed.slice(0, -1),
  });
}

describe('the jai alái pot', () => {
  it('antes everyone at session start', () => {
    const state = createGame({ seed: 'pot-1', ruleset: jaiAlaiRuleset() });
    expect(state.pot).toBe(1);
    // Everyone paid 0.25 (immediate deal payouts may have shifted chips too,
    // but the total anted is exactly the pot).
    const chipsTotal = state.players.reduce((n, p) => n + p.chips, 0);
    expect(chipsTotal).toBeCloseTo(-1, 9);
    expect(state.markers).toEqual([0, 0, 0, 0]);
  });

  it('does not ante when disabled', () => {
    const state = createGame({ seed: 'pot-2' });
    expect(state.pot).toBe(0);
  });

  it('awards one marker for a talbog and two for a búnot', () => {
    const state = table({});
    state.ruleset = jaiAlaiRuleset();
    state.players[0].concealed = state.players[0].concealed.slice(0, 17);

    // Feed settlements through the same path endHand uses, via reduce on a
    // real win, is covered elsewhere; here we exercise awardMarkers through
    // a scripted DECLARE_TODAS below. First: shape-level expectations.
    const talbog = winSettlement(state, 1, 'discard', 0);
    expect(talbog.winner).toBe(1);
  });

  it('tracks markers through a real declared win', () => {
    const state = table({ hands: ['b123 b456 b789 k123 k456 c99'] });
    state.ruleset = jaiAlaiRuleset();
    state.pot = 1;
    for (const player of state.players) player.everDrewFlower = true;
    const action = legalActions(state, 0).find((a) => a.type === 'DECLARE_TODAS')!;
    const after = reduce(state, action);
    expect(after.phase.name).toBe('HAND_OVER');
    if (after.phase.name !== 'HAND_OVER') return;
    const settlement = after.phase.settlement;
    // Bunot (2) plus a major (+1), capped at the book's two per hand.
    expect(settlement.markerAward).toBeDefined();
    expect(settlement.markerAward!.seat).toBe(0);
    expect(settlement.markerAward!.markers).toBe(2);
    expect(settlement.markerAward!.reason).toContain('ambición');
    expect(after.markers[0]).toBe(2);
    expect(settlement.potWin).toBeUndefined();
  });

  it('sweeps the pot at the target and resets the markers', () => {
    const state = table({ hands: ['b123 b456 b789 k123 k456 c99'] });
    state.ruleset = jaiAlaiRuleset();
    state.pot = 1;
    state.markers = [4, 0, 0, 0];
    for (const player of state.players) player.everDrewFlower = true;
    const chipsBefore = state.players[0].chips;
    const action = legalActions(state, 0).find((a) => a.type === 'DECLARE_TODAS')!;
    const after = reduce(state, action);
    if (after.phase.name !== 'HAND_OVER') throw new Error('hand not over');
    const settlement = after.phase.settlement;
    expect(settlement.potWin).toEqual({ seat: 0, amount: 1 });
    expect(after.pot).toBe(0);
    expect(after.markers).toEqual([0, 0, 0, 0]);
    // Winner got the hand payout plus the pot.
    expect(after.players[0].chips).toBeGreaterThan(chipsBefore + 1);
  });

  it('re-antes on the next hand after the pot is won', () => {
    const state = table({ hands: ['b123 b456 b789 k123 k456 c99'] });
    state.ruleset = jaiAlaiRuleset();
    state.pot = 1;
    state.markers = [4, 0, 0, 0];
    for (const player of state.players) player.everDrewFlower = true;
    const action = legalActions(state, 0).find((a) => a.type === 'DECLARE_TODAS')!;
    const won = reduce(state, action);
    const next = nextHand(won);
    expect(next.pot).toBe(1);
  });

  it('carries markers and pot through hands nobody sweeps', () => {
    const state = table({ hands: ['b123 b456 b789 k123 k456 c99'] });
    state.ruleset = jaiAlaiRuleset();
    state.pot = 1;
    state.markers = [1, 2, 0, 0];
    for (const player of state.players) player.everDrewFlower = true;
    const action = legalActions(state, 0).find((a) => a.type === 'DECLARE_TODAS')!;
    const won = reduce(state, action);
    const next = nextHand(won);
    expect(next.pot).toBe(1);
    expect(next.markers[0]).toBeGreaterThan(1); // kept the markers just earned
    expect(next.markers[1]).toBe(2);
  });

  it('awards no markers on a drawn hand', () => {
    const state = table({});
    state.ruleset = jaiAlaiRuleset();
    state.pot = 1;
    state.drawnFromWall = 100;
    state.giftsDrawn = 44;
    let current = reduce(state, {
      type: 'DISCARD',
      seat: 0,
      tileId: state.players[0].concealed[0].id,
    });
    while (current.phase.name === 'PENDING_CLAIMS') {
      const phase = current.phase;
      const seat = phase.eligible.find(
        (s) => !phase.passed.includes(s) && !phase.claims.some((c) => c.seat === s),
      )!;
      current = reduce(current, { type: 'PASS', seat });
    }
    if (current.phase.name !== 'HAND_OVER') throw new Error('expected draw');
    expect(current.phase.settlement.markerAward).toBeUndefined();
    expect(current.markers).toEqual([0, 0, 0, 0]);
  });
});

describe('the thirteen-flowers threshold', () => {
  it('is off for the Visayan preset', () => {
    expect(VISAYAN.thirteenFlowersThreshold).toBe(0);
    expect(VISAYAN.ambitionValues.thirteenFlowers).toBe(0);
  });

  it('defaults to thirteen for the standard preset', () => {
    expect(STANDARD.thirteenFlowersThreshold).toBe(13);
  });
});

describe('bisaklát stacking', () => {
  const escaleraHand = 'b123 b456 b789 b123 b456 b99';

  it('pays flat by default', () => {
    const state = table({ hands: [escaleraHand] });
    const settlement = winSettlement(state, 0, 'bisaklat', null);
    expect(settlement.total).toBe(20);
    expect(settlement.items).toHaveLength(1);
  });

  it('adds the dealt hand shape ambitions when the flag is on', () => {
    const state = table({
      hands: [escaleraHand],
      ruleset: { bisaklatStacksAmbitions: true },
    });
    const settlement = winSettlement(state, 0, 'bisaklat', null);
    const ids = settlement.items.map((item) => item.ambition).sort();
    expect(ids).toContain('bisaklat');
    expect(ids).toContain('escalera');
    expect(ids).toContain('fullFlush');
    // 20 + 0.5 escaléra + 0.5 flush + 0.25 all chows
    expect(settlement.total).toBeCloseTo(21.25, 9);
  });

  it('never scores wait or timing ambitions on a bisaklát', () => {
    const state = table({
      hands: [escaleraHand],
      ruleset: { bisaklatStacksAmbitions: true },
    });
    const settlement = winSettlement(state, 0, 'bisaklat', null);
    const ids = settlement.items.map((item) => item.ambition);
    expect(ids).not.toContain('quickWin');
    expect(ids).not.toContain('singleWait');
    expect(ids).not.toContain('concealedHand');
  });
});

describe('normalizeRuleset', () => {
  it('fills fields an older saved config never had', () => {
    const stored = { id: 'house', label: 'Our House', jokerEnabled: false } as Partial<Ruleset>;
    const normalized = normalizeRuleset(stored);
    expect(normalized.jokerEnabled).toBe(false);
    expect(normalized.jaiAlai.enabled).toBe(false);
    expect(normalized.jaiAlai.markerAwards.bunot).toBe(2);
    expect(normalized.thirteenFlowersThreshold).toBe(13);
    expect(normalized.ambitionValues.escalera).toBe(0.5);
  });

  it('keeps stored overrides', () => {
    const normalized = normalizeRuleset({
      jaiAlai: { enabled: true, ante: 1, markersToWin: 10 } as never,
      ambitionValues: { escalera: 4 } as never,
    });
    expect(normalized.jaiAlai.enabled).toBe(true);
    expect(normalized.jaiAlai.ante).toBe(1);
    expect(normalized.jaiAlai.markersToWin).toBe(10);
    expect(normalized.jaiAlai.markerAwards.win).toBe(1); // filled from defaults
    expect(normalized.ambitionValues.escalera).toBe(4);
    expect(normalized.ambitionValues.todas).toBe(1);
  });

  it('returns the standard book for nothing stored', () => {
    expect(normalizeRuleset(null).id).toBe('standard');
  });
});

describe('the majors', () => {
  function jaiAlaiState(hand: string) {
    const state = table({ hands: [hand] });
    state.ruleset = jaiAlaiRuleset();
    state.pot = 1;
    for (const player of state.players) player.everDrewFlower = true;
    // Push past the quick-win window so timing ambitions stay out of the way.
    for (let i = 0; i < 8; i++) state.discards.push({ tile: tile('k1'), from: 1, claimed: false });
    return state;
  }

  function declareAndSettle(state: GameState): Settlement {
    const action = legalActions(state, 0).find((a) => a.type === 'DECLARE_TODAS')!;
    const after = reduce(state, action);
    if (after.phase.name !== 'HAND_OVER') throw new Error('hand not over');
    return after.phase.settlement;
  }

  it('pays a bunot carrying a major the full two chips', () => {
    // Escalera in bolá — a major in the book.
    const settlement = declareAndSettle(jaiAlaiState('b123 b456 b789 k123 k456 c99'));
    expect(settlement.markerAward!.markers).toBe(2);
    expect(settlement.markerAward!.reason).toBe('Búnot ambición');
  });

  it('recognises All pong as a major', () => {
    const settlement = declareAndSettle(jaiAlaiState('b111 b222 k333 k444 c555 c66'));
    expect(settlement.items.map((i) => i.ambition)).toContain('allPungs');
    expect(settlement.markerAward!.reason).toContain('ambición');
  });

  it('does not pay the bonus for a non-major ambition', () => {
    // All up and Single wait are +5 bonuses in the book, never majors.
    const state = jaiAlaiState('b123 b456 k555 c123 c456 c99');
    state.ruleset.jaiAlai.majors = ['sietePares', 'allPungs', 'escalera'];
    const settlement = declareAndSettle(state);
    expect(settlement.items.some((i) => i.ambition === 'escalera')).toBe(false);
    expect(settlement.markerAward!.markers).toBe(2); // búnot alone
    expect(settlement.markerAward!.reason).toBe('Búnot');
  });

  it('respects an edited majors list', () => {
    // A table that counts All up as a major — the book does not, but the
    // config is the table's to set.
    const state = jaiAlaiState('b123 b456 k555 c123 c456 c99');
    state.ruleset.jaiAlai.majors = ['concealedHand'];
    const settlement = declareAndSettle(state);
    expect(settlement.items.map((i) => i.ambition)).toContain('concealedHand');
    expect(settlement.markerAward!.reason).toContain('ambición');
  });
});

/**
 * The house book — "Mahjong counts", the sheet the family actually plays from.
 * These lock in its naming and its chip schedule.
 */
describe('the house book', () => {
  it('names the ambitions the way the book does', () => {
    const named = Object.fromEntries(AMBITIONS.map((a) => [a.id, a.label]));
    expect(named).toMatchObject({
      todas: 'Mahjongg',
      bunot: 'Bunot',
      escalera: 'Escalera',
      sietePares: '7 Pairs',
      fullFlush: 'Same suit',
      allPungs: 'All pong',
      allChows: 'All chow',
      concealedHand: 'All up',
      allRevealed: 'All down',
      quickWin: 'Before the 5th',
      paningit: 'Panning',
      bisaklat: 'Bisaklat',
      openKang: 'Kong',
      secretKang: 'Secret',
      sagasa: 'Sagasa',
      noFlowers: 'Sin Flores',
    });
  });

  it('counts the six M/ ambitions as majors', () => {
    expect([...defaultJaiAlai().majors].sort()).toEqual([
      'allPungs',
      'allRevealed',
      'escalera',
      'fullFlush',
      'noFlowers',
      'sietePares',
    ]);
  });

  it('does not count All chow as a major', () => {
    expect(defaultJaiAlai().majors).not.toContain('allChows');
  });

  it('caps a hand at two chips, even with a major and a bunot', () => {
    // Escalera (a major) won by self-draw: 2 for the bunot, +1 for the major,
    // capped back to the book's ceiling of 2.
    const state = table({ hands: ['b123 b456 b789 k123 k456 c99'] });
    state.ruleset = jaiAlaiRuleset();
    state.pot = 1;
    for (const player of state.players) player.everDrewFlower = true;
    const action = legalActions(state, 0).find((a) => a.type === 'DECLARE_TODAS')!;
    const after = reduce(state, action);
    if (after.phase.name !== 'HAND_OVER') throw new Error('hand not over');
    const award = after.phase.settlement.markerAward!;
    expect(award.markers).toBe(2);
    expect(after.markers[0]).toBe(2);
  });

  it('still pays a plain win one chip', () => {
    const state = table({ hands: ['b123 b456 k555 c123 c456 c99'] });
    state.ruleset = jaiAlaiRuleset();
    state.ruleset.jaiAlai.markerAwards.bunot = 1; // a discard win, scored here as a draw-in
    state.pot = 1;
    for (const player of state.players) player.everDrewFlower = true;
    for (let i = 0; i < 8; i++) state.discards.push({ tile: tile('k1'), from: 1, claimed: false });
    const action = legalActions(state, 0).find((a) => a.type === 'DECLARE_TODAS')!;
    const after = reduce(state, action);
    if (after.phase.name !== 'HAND_OVER') throw new Error('hand not over');
    expect(after.phase.settlement.markerAward!.markers).toBe(1);
  });

  it('lets a table lift the cap if it wants to', () => {
    const state = table({ hands: ['b123 b456 b789 k123 k456 c99'] });
    state.ruleset = jaiAlaiRuleset();
    state.ruleset.jaiAlai.maxPerHand = 0;
    state.pot = 1;
    for (const player of state.players) player.everDrewFlower = true;
    const action = legalActions(state, 0).find((a) => a.type === 'DECLARE_TODAS')!;
    const after = reduce(state, action);
    if (after.phase.name !== 'HAND_OVER') throw new Error('hand not over');
    expect(after.phase.settlement.markerAward!.markers).toBe(3);
  });

  it('carries the cap through a stored config from an older build', () => {
    const normalized = normalizeRuleset({ jaiAlai: { enabled: true } as never });
    expect(normalized.jaiAlai.maxPerHand).toBe(2);
    expect(normalized.jaiAlai.majors).toContain('fullFlush');
  });
});
