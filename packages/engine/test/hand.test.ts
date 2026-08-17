import { describe, expect, it } from 'vitest';
import {
  analyseWin,
  concealedKangFaces,
  expectedTileCount,
  handTileCount,
  isSietePares,
  isWinningHand,
  winningFaces,
} from '../src/hand.js';
import { createRng } from '../src/rng.js';
import { buildTileSet, isSuited } from '../src/tiles.js';
import type { Tile } from '../src/types.js';
import { chow, face, kang, pung, tiles } from './helpers.js';

const base = { melds: [], joker: null, sieteParesRequiresConcealed: false };

describe('the standard shape — five báhay and an eye', () => {
  it('accepts five chows plus a pair', () => {
    // 3+3+3+3+3 + 2 = 17
    const hand = tiles('b123 b456 b789 k123 k456 c99');
    expect(handTileCount(hand, [])).toBe(17);
    expect(isWinningHand({ ...base, concealed: hand })).toBe(true);
  });

  it('accepts five pungs plus a pair', () => {
    const hand = tiles('b111 b222 k333 k444 c555 c66');
    expect(isWinningHand({ ...base, concealed: hand })).toBe(true);
  });

  it('accepts a mixed hand', () => {
    const hand = tiles('b123 b123 k555 c789 c789 b44');
    expect(isWinningHand({ ...base, concealed: hand })).toBe(true);
  });

  it('rejects a hand one tile short of a set', () => {
    const hand = tiles('b123 b456 b789 k123 k457 c99');
    expect(isWinningHand({ ...base, concealed: hand })).toBe(false);
  });

  it('rejects a hand with no eye', () => {
    const hand = tiles('b123 b456 b789 k123 k456 c98');
    expect(isWinningHand({ ...base, concealed: hand })).toBe(false);
  });

  it('rejects a hand of the wrong size', () => {
    expect(isWinningHand({ ...base, concealed: tiles('b123 b456 b789 k123 k456 c9') })).toBe(false);
    expect(isWinningHand({ ...base, concealed: tiles('b123 b456 b789 k123 k456 c999') })).toBe(
      false,
    );
  });

  it('does not require a chow to be inside one suit', () => {
    // b9 k1 c2 is not a run.
    const hand = tiles('b123 b456 b789 k123 b9 k1 c2 c99');
    expect(isWinningHand({ ...base, concealed: hand })).toBe(false);
  });
});

describe('exposed melds', () => {
  it('reduces the number of sets the concealed pool must supply', () => {
    const hand = tiles('b123 b456 k123 k456 c99');
    const melds = [pung('c555')];
    expect(handTileCount(hand, melds)).toBe(17);
    expect(isWinningHand({ ...base, concealed: hand, melds })).toBe(true);
  });

  it('adjusts the hand-size invariant by one tile per kang', () => {
    const melds = [kang('b1111'), pung('c555')];
    expect(expectedTileCount(melds)).toBe(18);
    const hand = tiles('b456 k123 k456 c99');
    expect(handTileCount(hand, melds)).toBe(18);
    expect(isWinningHand({ ...base, concealed: hand, melds })).toBe(true);
  });

  it('rejects a kang hand that ignores the extra tile', () => {
    const melds = [kang('b1111')];
    const hand = tiles('b456 k123 k456 c789 c9');
    expect(handTileCount(hand, melds)).toBe(17);
    expect(isWinningHand({ ...base, concealed: hand, melds })).toBe(false);
  });
});

describe('siete pares — seven pairs plus one báhay', () => {
  it('accepts seven pairs and a concealed set', () => {
    const hand = tiles('b11 b22 b33 k44 k55 c66 c77 c888');
    expect(hand.length).toBe(17);
    expect(isWinningHand({ ...base, concealed: hand })).toBe(true);
    expect(isSietePares({ ...base, concealed: hand })).not.toBeNull();
  });

  it('accepts seven pairs with the báhay exposed', () => {
    const hand = tiles('b11 b22 b33 k44 k55 c66 c77');
    const melds = [pung('c888')];
    expect(isSietePares({ ...base, concealed: hand, melds })).not.toBeNull();
  });

  it('honours sieteParesRequiresConcealed', () => {
    const hand = tiles('b11 b22 b33 k44 k55 c66 c77');
    const melds = [pung('c888')];
    expect(
      isSietePares({
        concealed: hand,
        melds,
        joker: null,
        sieteParesRequiresConcealed: true,
      }),
    ).toBeNull();
  });

  it('rejects six pairs and a leftover', () => {
    const hand = tiles('b11 b22 b33 k44 k55 c66 c78 c888');
    expect(isSietePares({ ...base, concealed: hand })).toBeNull();
  });

  it('counts four of a kind as two pairs', () => {
    const hand = tiles('b1111 b22 b33 k44 k55 c66 c777');
    expect(isSietePares({ ...base, concealed: hand })).not.toBeNull();
  });
});

describe('jokers', () => {
  const joker = face('c1');

  it('substitutes for a missing tile', () => {
    // c1 is the joker; the hand is one 9-balls short of a pung.
    const hand = tiles('b123 b456 b789 k123 b99 c1 k44');
    expect(isWinningHand({ ...base, concealed: hand, joker })).toBe(true);
  });

  it('can serve as the eye', () => {
    const hand = tiles('b123 b456 b789 k123 k456 b9 c1');
    expect(isWinningHand({ ...base, concealed: hand, joker })).toBe(true);
  });

  it('is not wild when the ruleset has jokers off', () => {
    const hand = tiles('b123 b456 b789 k123 b99 c1 k44');
    expect(isWinningHand({ ...base, concealed: hand, joker: null })).toBe(false);
  });

  it('allows at most one joker per pair in siete pares', () => {
    // Six real pairs, one lone tile completed by a joker, plus a set.
    const hand = tiles('b11 b22 b33 k44 k55 c66 c7 c1 c888');
    expect(isSietePares({ ...base, concealed: hand, joker })).not.toBeNull();

    // Two jokers with no lone tiles to pair with cannot form a pair together.
    const twoJokerHand = tiles('b11 b22 b33 k44 k55 c66 c11 c888');
    expect(isSietePares({ ...base, concealed: twoJokerHand, joker })).toBeNull();
  });

  it('counts toward the suit of whatever it stands in for', () => {
    // A full flush in balls where the joker stands in for the 6 balls.
    const hand = tiles('b123 b456 b789 b123 b45 b99 c1');
    expect(hand.length).toBe(17);
    const shapes = analyseWin({ ...base, concealed: hand, joker });
    expect(shapes.length).toBeGreaterThan(0);
  });
});

describe('winningFaces — "what am I waiting on?"', () => {
  it('finds a two-sided wait', () => {
    const hand = tiles('b123 b456 b789 k123 k45 c99');
    expect(hand.length).toBe(16);
    const waits = winningFaces({ ...base, concealed: hand }).map((f) => `${f.suit}${f.rank}`);
    expect(waits.sort()).toEqual(['sticks3', 'sticks6']);
  });

  it('finds a pair wait', () => {
    const hand = tiles('b123 b456 b789 k123 k456 c9');
    const waits = winningFaces({ ...base, concealed: hand });
    expect(waits).toHaveLength(1);
    expect(waits[0]).toEqual({ suit: 'chars', rank: 9 });
  });

  it('returns nothing for a hand of the wrong size', () => {
    expect(winningFaces({ ...base, concealed: tiles('b123') })).toEqual([]);
  });
});

describe('concealedKangFaces', () => {
  it('finds four-of-a-kind in the concealed pool', () => {
    const faces = concealedKangFaces(tiles('b1111 k222 c99'));
    expect(faces).toEqual([{ suit: 'balls', rank: 1 }]);
  });
});

describe('property: the detector is total and consistent', () => {
  it('never both accepts and rejects the same hand, and never accepts a wrong-size hand', () => {
    const rng = createRng('property-seed');
    const suited = buildTileSet().filter(isSuited) as Tile[];
    let accepted = 0;

    for (let trial = 0; trial < 10_000; trial++) {
      const pool = [...suited];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const size = 15 + rng.int(4); // 15..18
      const hand = pool.slice(0, size);
      const first = isWinningHand({ ...base, concealed: hand });
      const second = isWinningHand({ ...base, concealed: [...hand].reverse() });
      expect(first).toBe(second);
      if (size !== 17) expect(first).toBe(false);
      if (first) {
        accepted++;
        expect(analyseWin({ ...base, concealed: hand }).length).toBeGreaterThan(0);
      }
    }
    // Sanity: random 17-tile hands do occasionally win, but rarely.
    expect(accepted).toBeLessThan(200);
  });

  it('agrees with analyseWin on 2,000 near-complete hands', () => {
    const rng = createRng('near-complete');
    for (let trial = 0; trial < 2_000; trial++) {
      const hand = tiles('b123 b456 b789 k123 k456 c99');
      // Swap one tile out for a random other tile and re-check both paths.
      const idx = rng.int(hand.length);
      hand[idx] = {
        kind: 'suited',
        suit: 'chars',
        rank: (1 + rng.int(9)) as 1,
        id: `mutant-${trial}`,
      };
      const won = isWinningHand({ ...base, concealed: hand });
      expect(won).toBe(analyseWin({ ...base, concealed: hand }).length > 0);
    }
  });
});
