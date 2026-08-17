import { describe, expect, it } from 'vitest';
import { buildTileSet, createRng, isSuited, isWinningHand } from '@bahay/engine';
import type { Meld, Rank, Suit, Tile } from '@bahay/engine';
import { acceptingFaces, shanten, shantenSietePares, shantenStandard } from '../src/shanten.js';

const SUIT_CODES: Record<string, Suit> = { b: 'balls', k: 'sticks', c: 'chars' };

function tiles(spec: string): Tile[] {
  const out: Tile[] = [];
  const used = new Map<string, number>();
  for (const group of spec.trim().split(/\s+/)) {
    const suit = SUIT_CODES[group[0]];
    for (const ch of group.slice(1)) {
      const rank = Number(ch) as Rank;
      const key = `${suit}-${rank}`;
      const copy = used.get(key) ?? 0;
      used.set(key, copy + 1);
      out.push({ kind: 'suited', suit, rank, id: `${key}-c${copy}` });
    }
  }
  return out;
}

const noMelds: Meld[] = [];

describe('shanten for the standard shape', () => {
  it('reports -1 for a complete hand', () => {
    const hand = tiles('b123 b456 b789 k123 k456 c99');
    expect(shanten({ concealed: hand, melds: noMelds, joker: null })).toBe(-1);
  });

  it('reports 0 for a hand waiting on one tile', () => {
    const hand = tiles('b123 b456 b789 k123 k45 c99');
    expect(shanten({ concealed: hand, melds: noMelds, joker: null })).toBe(0);
  });

  it('grows as the hand gets further away', () => {
    const waiting = shanten({
      concealed: tiles('b123 b456 b789 k123 k45 c99'),
      melds: noMelds,
      joker: null,
    });
    const scattered = shanten({
      concealed: tiles('b147 k258 c369 b258 c1 k9'),
      melds: noMelds,
      joker: null,
    });
    expect(scattered).toBeGreaterThan(waiting);
  });

  it('counts exposed melds as sets already made', () => {
    const concealed = tiles('b123 b456 k123 k45 c99');
    const withMeld = shanten({
      concealed,
      melds: [
        {
          type: 'pung',
          tiles: tiles('c555') as [Tile, Tile, Tile],
          claimedFrom: 1,
        },
      ],
      joker: null,
    });
    expect(withMeld).toBe(0);
  });

  it('never returns -1 for a hand that is still short', () => {
    const hand = tiles('b123 b456 b789 k123 k456');
    expect(shanten({ concealed: hand, melds: noMelds, joker: null })).toBeGreaterThanOrEqual(0);
  });

  it('gets closer with every joker held', () => {
    const hand = tiles('b123 b456 b789 k123 k4 c99');
    const withoutJoker = shantenStandard({ concealed: hand, melds: noMelds, joker: null });
    const withJoker = shantenStandard({
      concealed: [...hand, ...tiles('c1')],
      melds: noMelds,
      joker: { suit: 'chars', rank: 1 },
    });
    expect(withJoker).toBeLessThan(withoutJoker);
  });
});

describe('shanten for siete pares', () => {
  it('reports -1 for seven pairs and a set', () => {
    const hand = tiles('b11 b22 b33 k44 k55 c66 c77 c888');
    expect(shantenSietePares({ concealed: hand, melds: noMelds, joker: null })).toBe(-1);
  });

  it('is unreachable once two melds are exposed', () => {
    const melds: Meld[] = [
      { type: 'pung', tiles: tiles('c555') as [Tile, Tile, Tile], claimedFrom: 1 },
      { type: 'pung', tiles: tiles('c666') as [Tile, Tile, Tile], claimedFrom: 1 },
    ];
    expect(shantenSietePares({ concealed: tiles('b11 b22'), melds, joker: null })).toBe(Infinity);
  });

  it('is the better route for a hand full of pairs', () => {
    const hand = tiles('b11 b22 b33 k44 k55 c66 c78 c88');
    const standard = shantenStandard({ concealed: hand, melds: noMelds, joker: null });
    const siete = shantenSietePares({ concealed: hand, melds: noMelds, joker: null });
    expect(siete).toBeLessThan(standard);
    // The pair count already reads as complete, but a 16-tile hand cannot be
    // won, so the reported distance floors at zero — waiting, not won.
    expect(shanten({ concealed: hand, melds: noMelds, joker: null })).toBe(0);
    const complete = tiles('b11 b22 b33 k44 k55 c66 c888 c99');
    expect(shanten({ concealed: complete, melds: noMelds, joker: null })).toBe(-1);
  });
});

describe('tile acceptance', () => {
  it('names exactly the tiles that would complete a two-sided wait', () => {
    const hand = tiles('b123 b456 b789 k123 k45 c99');
    const faces = acceptingFaces({ concealed: hand, melds: noMelds, joker: null }).map(
      (f) => `${f.suit}${f.rank}`,
    );
    expect(faces.sort()).toEqual(['sticks3', 'sticks6']);
  });

  it('finds several improvements for a loose hand', () => {
    const hand = tiles('b123 b456 b78 k123 k45 c9 c9');
    const faces = acceptingFaces({ concealed: hand, melds: noMelds, joker: null });
    expect(faces.length).toBeGreaterThan(1);
  });
});

describe('the fast solver agrees with the exact win detector', () => {
  it('reports -1 exactly when the engine says the hand is won, over 3,000 hands', () => {
    const rng = createRng('shanten-cross-check');
    const suited = buildTileSet().filter(isSuited);
    for (let trial = 0; trial < 3_000; trial++) {
      const pool = [...suited];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const hand = pool.slice(0, 17);
      const won = isWinningHand({
        concealed: hand,
        melds: noMelds,
        joker: null,
        sieteParesRequiresConcealed: false,
      });
      expect(shanten({ concealed: hand, melds: noMelds, joker: null }) === -1).toBe(won);
    }
  });

  it('agrees on hands built to be one tile away', () => {
    const rng = createRng('shanten-tenpai');
    const complete = tiles('b123 b456 b789 k123 k456 c99');
    for (let trial = 0; trial < 200; trial++) {
      const missing = rng.int(complete.length);
      const hand = complete.filter((_, i) => i !== missing);
      expect(shanten({ concealed: hand, melds: noMelds, joker: null })).toBe(0);
    }
  });
});
