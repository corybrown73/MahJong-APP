import { describe, expect, it } from 'vitest';
import { settle, drawSettlement } from '../src/scoring.js';
import type { AmbitionId, GameState, SeatId, Tile } from '../src/types.js';
import { chow, kang, pung, table, tile, tiles } from './helpers.js';

/**
 * A table where seat 0 is about to be paid: flowers already drawn (so the
 * No Flowers bonus does not fire) and enough discards gone by that Quick Win
 * does not fire either. Each test then opts into exactly what it is measuring.
 */
function payable(spec: Parameters<typeof table>[0] = {}): GameState {
  const state = table(spec);
  for (const player of state.players) player.everDrewFlower = true;
  for (let i = 0; i < 8; i++) {
    state.discards.push({ tile: tile('k1'), from: 1, claimed: false });
  }
  return state;
}

function itemIds(items: { ambition: AmbitionId }[]): AmbitionId[] {
  return items.map((i) => i.ambition).sort();
}

function winOnDiscard(state: GameState, winner: SeatId, winningTile: Tile, discarder: SeatId) {
  const before = state.players[winner].concealed.filter((t) => t.id !== winningTile.id);
  return settle({ state, winner, winType: 'discard', discarder, winningTile, concealedBefore: before });
}

describe('base settlement', () => {
  it('pays 1.00, doubled by the discarder', () => {
    const state = payable({ hands: ['b123 b456 b789 k123 k456 c99'] });
    const result = winOnDiscard(state, 0, tile('k6'), 2);
    expect(result.items.some((i) => i.ambition === 'todas')).toBe(true);
    const paidByDiscarder = result.transfers.find((t) => t.from === 2)!;
    const paidByOther = result.transfers.find((t) => t.from === 1)!;
    expect(paidByDiscarder.amount).toBe(result.total * 2);
    expect(paidByOther.amount).toBe(result.total);
    expect(result.transfers).toHaveLength(3);
  });

  it('applies búnot as a multiplier on the whole payout, not a line item', () => {
    const state = payable({ hands: ['b123 b456 b789 k123 k456 c99'] });
    const onDiscard = winOnDiscard(state, 0, tile('k6'), 2);
    const selfDrawn = settle({
      state,
      winner: 0,
      winType: 'bunot',
      discarder: null,
      winningTile: tile('k6'),
      concealedBefore: null,
    });
    expect(selfDrawn.total).toBe(onDiscard.total * 2);
    expect(selfDrawn.multipliers.some((m) => m.factor === 2)).toBe(true);
    // Self-drawn: all three pay the same amount.
    expect(new Set(selfDrawn.transfers.map((t) => t.amount)).size).toBe(1);
  });

  it('doubles again on a doubles roll', () => {
    const state = payable({ hands: ['b123 b456 b789 k123 k456 c99'] });
    const plain = winOnDiscard(state, 0, tile('k6'), 2);
    state.doublesActive = true;
    const doubled = winOnDiscard(state, 0, tile('k6'), 2);
    expect(doubled.total).toBe(plain.total * 2);
  });

  it('records a draw as nobody paying anybody', () => {
    const state = payable();
    const result = drawSettlement(state);
    expect(result.winner).toBeNull();
    expect(result.winType).toBe('draw');
    expect(result.transfers).toEqual([]);
  });
});

describe('hand-structure ambitions', () => {
  it('scores escaléra with all chows and a concealed hand', () => {
    const state = payable({ hands: ['b123 b456 b789 k123 k456 c99'] });
    const result = winOnDiscard(state, 0, tile('k6'), 2);
    expect(itemIds(result.items)).toContain('escalera');
    expect(itemIds(result.items)).toContain('allChows');
    expect(itemIds(result.items)).toContain('concealedHand');
    // 1.00 + 0.50 + 0.25 + 0.25 = 2.00
    expect(result.total).toBe(2);
  });

  it('scores a full flush alongside escaléra', () => {
    const state = payable({ hands: ['b123 b456 b789 b123 b456 b99'] });
    const result = winOnDiscard(state, 0, tile('b6'), 2);
    expect(itemIds(result.items)).toContain('fullFlush');
    expect(itemIds(result.items)).toContain('escalera');
  });

  it('scores all pungs and never all chows at the same time', () => {
    const state = payable({ hands: ['b111 b222 k333 k444 c555 c66'] });
    const result = winOnDiscard(state, 0, tile('c5'), 2);
    expect(itemIds(result.items)).toContain('allPungs');
    expect(itemIds(result.items)).not.toContain('allChows');
  });

  it('scores siete pares and never all pungs or escaléra with it', () => {
    const state = payable({ hands: ['b11 b22 b33 k44 k55 c66 c77 c888'] });
    const result = winOnDiscard(state, 0, tile('c8'), 2);
    expect(itemIds(result.items)).toContain('sietePares');
    expect(itemIds(result.items)).not.toContain('allPungs');
    expect(itemIds(result.items)).not.toContain('escalera');
  });

  it('scores all revealed when every set is exposed, and not concealed hand', () => {
    const state = payable({
      hands: ['b99'],
      melds: [[chow('b123'), chow('b456'), chow('b789'), pung('k555'), pung('c777')]],
    });
    const result = winOnDiscard(state, 0, tile('b9'), 2);
    expect(itemIds(result.items)).toContain('allRevealed');
    expect(itemIds(result.items)).not.toContain('concealedHand');
  });

  it('keeps a hand concealed through a secret kang but not an open one', () => {
    const secret = payable({
      hands: ['b456 k123 k456 c789 c99'],
      melds: [[kang('b1111', 'secret')]],
    });
    expect(itemIds(winOnDiscard(secret, 0, tile('c9'), 2).items)).toContain('concealedHand');

    const open = payable({
      hands: ['b456 k123 k456 c789 c99'],
      melds: [[kang('b1111', 'open')]],
    });
    expect(itemIds(winOnDiscard(open, 0, tile('c9'), 2).items)).not.toContain('concealedHand');
  });

  it('scores a quick win inside the discard limit', () => {
    const state = table({ hands: ['b123 b456 b789 k123 k456 c99'] });
    for (const player of state.players) player.everDrewFlower = true;
    state.discards.push({ tile: tile('k1'), from: 1, claimed: false });
    const result = winOnDiscard(state, 0, tile('k6'), 2);
    expect(itemIds(result.items)).toContain('quickWin');
  });
});

describe('wait-shape ambitions — at most one', () => {
  it('scores paníngit on the middle tile of a chow', () => {
    const state = payable({ hands: ['b123 b456 b789 k123 k456 c99'] });
    const result = winOnDiscard(state, 0, tile('k5'), 2);
    const waits = itemIds(result.items).filter((id) =>
      ['paningit', 'singleWait', 'backToBack'].includes(id),
    );
    expect(waits).toEqual(['paningit']);
  });

  it('scores a single wait on the eye', () => {
    const state = payable({ hands: ['b123 b456 b789 k123 k456 c99'] });
    const result = winOnDiscard(state, 0, tile('c9'), 2);
    const waits = itemIds(result.items).filter((id) =>
      ['paningit', 'singleWait', 'backToBack'].includes(id),
    );
    expect(waits).toEqual(['singleWait']);
  });

  it('scores back to back when either of two pairs would complete the hand', () => {
    // Four sets, then a 9-chars pair and a 5-sticks pair: either becomes the
    // fifth set, with the other left as the eye.
    const state = payable({ hands: ['b123 b456 b789 k123 c999 k55'] });
    const result = winOnDiscard(state, 0, tile('c9'), 2);
    const waits = itemIds(result.items).filter((id) =>
      ['paningit', 'singleWait', 'backToBack'].includes(id),
    );
    expect(waits).toEqual(['backToBack']);
  });

  it('never scores two wait ambitions at once', () => {
    const state = payable({ hands: ['b123 b456 b789 k123 k456 c99'] });
    for (const winningTile of [tile('k5'), tile('c9'), tile('k4')]) {
      const result = winOnDiscard(state, 0, winningTile, 2);
      const waits = itemIds(result.items).filter((id) =>
        ['paningit', 'singleWait', 'backToBack'].includes(id),
      );
      expect(waits.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('bisaklát', () => {
  it('is a flat payout that replaces all other scoring', () => {
    const state = payable({ hands: ['b123 b456 b789 k123 k456 c99'] });
    const result = settle({
      state,
      winner: 0,
      winType: 'bisaklat',
      discarder: null,
      winningTile: null,
      concealedBefore: null,
    });
    expect(result.total).toBe(20);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].ambition).toBe('bisaklat');
    expect(result.transfers.every((t) => t.amount === 20)).toBe(true);
  });

  it('honours a house-rule value', () => {
    const state = payable({
      hands: ['b123 b456 b789 k123 k456 c99'],
      ruleset: { bisaklatValue: 12 },
    });
    const result = settle({
      state,
      winner: 0,
      winType: 'bisaklat',
      discarder: null,
      winningTile: null,
      concealedBefore: null,
    });
    expect(result.total).toBe(12);
  });
});

describe('no flowers', () => {
  it('pays a second time when the winner never drew one', () => {
    const state = payable({ hands: ['b123 b456 b789 k123 k456 c99'] });
    const withFlowers = winOnDiscard(state, 0, tile('c9'), 2);
    state.players[0].everDrewFlower = false;
    const withoutFlowers = winOnDiscard(state, 0, tile('c9'), 2);
    expect(withoutFlowers.total).toBe(withFlowers.total + 0.25);
  });
});

describe('house rules override every value', () => {
  it('uses the configured ambition values', () => {
    const state = payable({
      hands: ['b123 b456 b789 k123 k456 c99'],
      ruleset: { ambitionValues: { escalera: 2, todas: 3 } as never },
    });
    const result = winOnDiscard(state, 0, tile('k6'), 2);
    const escalera = result.items.find((i) => i.ambition === 'escalera')!;
    const base = result.items.find((i) => i.ambition === 'todas')!;
    expect(escalera.value).toBe(2);
    expect(base.value).toBe(3);
  });

  it('drops an ambition set to zero', () => {
    const state = payable({
      hands: ['b123 b456 b789 k123 k456 c99'],
      ruleset: { ambitionValues: { escalera: 0 } as never },
    });
    const result = winOnDiscard(state, 0, tile('k6'), 2);
    expect(itemIds(result.items)).not.toContain('escalera');
  });
});

describe('the settlement explains itself', () => {
  it('itemizes every line and the transfers add up to the total', () => {
    const state = payable({ hands: ['b123 b456 b789 k123 k456 c99'] });
    const result = winOnDiscard(state, 0, tile('k6'), 2);
    const sum = result.items.reduce((n, i) => n + i.value, 0);
    const withMultipliers = result.multipliers.reduce((n, m) => n * m.factor, sum);
    expect(result.total).toBe(withMultipliers);
    expect(result.transfers.every((t) => t.to === 0)).toBe(true);
    expect(result.items.every((i) => i.label.length > 0)).toBe(true);
  });
});
