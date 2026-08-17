import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game.js';
import { faceLabel, sortTiles, tileLabel } from '../src/tiles.js';
import { publicView, unseenCount, unseenCounts } from '../src/view.js';
import { face, pung, table, tile, tiles } from './helpers.js';

describe('the public view', () => {
  it('shows other players as counts, never as tiles', () => {
    const state = createGame({ seed: 'view-1' });
    const view = publicView(state, 0);
    expect(view.hand).toHaveLength(17);
    expect(view.players[1].concealedCount).toBe(16);
    expect(Object.keys(view.players[1])).not.toContain('concealed');
    expect(JSON.stringify(view)).not.toContain(state.players[1].concealed[0].id);
  });

  it('never leaks the wall order', () => {
    const state = createGame({ seed: 'view-2' });
    const view = publicView(state, 0);
    expect((view as Record<string, unknown>).wall).toBeUndefined();
    expect(view.tilesRemaining).toBeGreaterThan(0);
  });
});

describe('how many are left unseen', () => {
  it('starts at four and counts down as tiles become visible', () => {
    const state = table({ hands: ['b555 c111'] });
    const view = publicView(state, 0);
    expect(unseenCount(view, face('b5'))).toBe(1); // three in my own hand
    expect(unseenCount(view, face('k7'))).toBe(4);
  });

  it('counts discards and exposed melds', () => {
    const state = table({ hands: ['c111'], melds: [[pung('k777')]] });
    state.discards.push({ tile: tile('k7'), from: 2, claimed: false });
    const view = publicView(state, 0);
    expect(unseenCount(view, face('k7'))).toBe(0);
  });

  it('builds a map covering all 27 faces', () => {
    const view = publicView(table({ hands: ['c111'] }), 0);
    expect(unseenCounts(view).size).toBe(27);
  });
});

describe('presentation helpers', () => {
  it('sorts a rack by suit then rank without mutating it', () => {
    const hand = tiles('c9 b3 k1 b1');
    const sorted = sortTiles(hand);
    expect(sorted.map((t) => tileLabel(t))).toEqual(['1B', '3B', '1K', '9L']);
    expect(hand.map((t) => tileLabel(t))).toEqual(['9L', '3B', '1K', '1B']);
  });

  it('names a face in Filipino', () => {
    expect(faceLabel(face('b5'))).toBe('5 bolá');
    expect(faceLabel(face('k1'))).toBe('1 kahoy');
    expect(faceLabel(face('c9'))).toBe('9 letra');
  });
});
