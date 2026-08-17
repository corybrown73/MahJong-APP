import { describe, expect, it } from 'vitest';
import {
  chowOptions,
  chowSourceSeat,
  claimOptions,
  kangOption,
  pungOption,
  resolveClaims,
  seatDistance,
} from '../src/calls.js';
import type { Claim, SeatId } from '../src/types.js';
import { table, tile, tiles } from './helpers.js';

describe('chow eligibility', () => {
  it('seat N may chow only from seat (N + 3) % 4', () => {
    expect(chowSourceSeat(0)).toBe(3);
    expect(chowSourceSeat(1)).toBe(0);
    expect(chowSourceSeat(2)).toBe(1);
    expect(chowSourceSeat(3)).toBe(2);
  });

  it('offers every run the hand can make', () => {
    const hand = tiles('b345 b67');
    const options = chowOptions(hand, tile('b5'));
    // 3-4-5, 4-5-6, 5-6-7
    expect(options).toHaveLength(3);
  });

  it('does not run off the end of a suit', () => {
    expect(chowOptions(tiles('b78'), tile('b9'))).toHaveLength(1);
    expect(chowOptions(tiles('b23'), tile('b1'))).toHaveLength(1);
  });

  it('does not cross suits', () => {
    expect(chowOptions(tiles('k23'), tile('b1'))).toHaveLength(0);
  });

  it('is refused from the wrong seat under standard rules', () => {
    const state = table({ hands: [undefined, 'b234 c99', undefined, undefined] });
    // Seat 1 may only chow from seat 0.
    const fromSeat0 = claimOptions(state, 1, tile('b5'), 0);
    const fromSeat2 = claimOptions(state, 1, tile('b5'), 2);
    expect(fromSeat0.some((o) => o.call === 'chow')).toBe(true);
    expect(fromSeat2.some((o) => o.call === 'chow')).toBe(false);
  });

  it('is allowed from anyone when the house rule says so', () => {
    const state = table({
      hands: [undefined, 'b234 c99', undefined, undefined],
      ruleset: { chowFromAnyPlayer: true },
    });
    expect(claimOptions(state, 1, tile('b5'), 2).some((o) => o.call === 'chow')).toBe(true);
  });
});

describe('pung and kang', () => {
  it('needs two matching tiles for a pung', () => {
    expect(pungOption(tiles('b55'), tile('b5'))).not.toBeNull();
    expect(pungOption(tiles('b5'), tile('b5'))).toBeNull();
  });

  it('needs three matching tiles for a kang', () => {
    expect(kangOption(tiles('b555'), tile('b5'))).not.toBeNull();
    expect(kangOption(tiles('b55'), tile('b5'))).toBeNull();
  });

  it('is available to any seat, not just the next one', () => {
    const state = table({ hands: [undefined, undefined, 'b555 c99', undefined] });
    const options = claimOptions(state, 2, tile('b5'), 0);
    expect(options.map((o) => o.call).sort()).toEqual(['kang', 'pung']);
  });
});

describe('claim priority', () => {
  const claim = (seat: SeatId, call: Claim['call']): Claim => ({ seat, call, tileIds: [] });

  it('tódas beats everything', () => {
    const { winners } = resolveClaims([claim(1, 'chow'), claim(2, 'todas'), claim(3, 'pung')], 0, false);
    expect(winners).toHaveLength(1);
    expect(winners[0].call).toBe('todas');
  });

  it('pung beats chow', () => {
    const { winners } = resolveClaims([claim(1, 'chow'), claim(3, 'pung')], 0, false);
    expect(winners[0].call).toBe('pung');
  });

  it('kang beats chow', () => {
    const { winners } = resolveClaims([claim(1, 'chow'), claim(2, 'kang')], 0, false);
    expect(winners[0].call).toBe('kang');
  });

  it('breaks a tódas tie by turn order from the discarder', () => {
    const { winners } = resolveClaims([claim(3, 'todas'), claim(1, 'todas')], 0, false);
    expect(winners).toHaveLength(1);
    expect(winners[0].seat).toBe(1);
  });

  it('pays every winner when the house rule allows it', () => {
    const { winners } = resolveClaims([claim(3, 'todas'), claim(1, 'todas')], 0, true);
    expect(winners).toHaveLength(2);
  });

  it('resolves an empty window to nobody', () => {
    expect(resolveClaims([], 0, false).winners).toEqual([]);
  });

  it('measures seat distance counterclockwise from the discarder', () => {
    expect(seatDistance(0, 1)).toBe(1);
    expect(seatDistance(3, 0)).toBe(1);
    expect(seatDistance(0, 3)).toBe(3);
  });
});

describe('tódas on a discard', () => {
  it('is offered when the discard completes the hand', () => {
    const state = table({ hands: [undefined, 'b123 b456 b789 k123 k45 c99', undefined, undefined] });
    const options = claimOptions(state, 1, tile('k6'), 0);
    expect(options.some((o) => o.call === 'todas')).toBe(true);
  });

  it('is offered even if the player passed on that face earlier — no furiten', () => {
    const state = table({ hands: [undefined, 'b123 b456 b789 k123 k45 c99', undefined, undefined] });
    state.discards.push({ tile: tile('k3'), from: 1, claimed: false });
    const options = claimOptions(state, 1, tile('k3'), 0);
    expect(options.some((o) => o.call === 'todas')).toBe(true);
  });
});
