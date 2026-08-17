import { describe, expect, it } from 'vitest';
import { createRng, shuffle } from '../src/rng.js';
import { buildTileSet, isFlower, isSuited } from '../src/tiles.js';
import {
  breakPoint,
  buildWall,
  isDoubles,
  rollDice,
  takeFromDrawWall,
  takeFromFlowerWall,
  wallExhausted,
  wallRemaining,
  WALL_SIZE,
} from '../src/wall.js';

describe('the tile set', () => {
  it('is 144 tiles: 108 suited and 36 flowers', () => {
    const set = buildTileSet();
    expect(set).toHaveLength(144);
    expect(set.filter(isSuited)).toHaveLength(108);
    expect(set.filter(isFlower)).toHaveLength(36);
  });

  it('has four copies of every suited tile and unique ids', () => {
    const set = buildTileSet();
    expect(new Set(set.map((t) => t.id)).size).toBe(144);
    const fives = set.filter((t) => t.kind === 'suited' && t.suit === 'balls' && t.rank === 5);
    expect(fives).toHaveLength(4);
  });

  it('splits the flowers into 16 winds, 12 dragons and 8 seasons', () => {
    const flowers = buildTileSet().filter(isFlower);
    expect(flowers.filter((f) => f.group === 'wind')).toHaveLength(16);
    expect(flowers.filter((f) => f.group === 'dragon')).toHaveLength(12);
    expect(flowers.filter((f) => f.group === 'season')).toHaveLength(8);
  });
});

describe('shuffling is deterministic', () => {
  it('produces the same wall for the same seed', () => {
    const a = buildWall('abc').map((t) => t.id);
    const b = buildWall('abc').map((t) => t.id);
    const c = buildWall('abd').map((t) => t.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('is a permutation, not a resample', () => {
    const shuffled = shuffle([1, 2, 3, 4, 5], createRng('x'));
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('breaking the wall', () => {
  it('lands inside the wall the dice picked', () => {
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        const point = breakPoint(0, [a, b]);
        expect(point).toBeGreaterThanOrEqual(0);
        expect(point).toBeLessThan(WALL_SIZE);
      }
    }
  });

  it('moves with the dealer', () => {
    expect(breakPoint(0, [3, 4])).not.toBe(breakPoint(1, [3, 4]));
  });

  it('rolls the same dice for the same seed and hand', () => {
    expect(rollDice('s', 1)).toEqual(rollDice('s', 1));
    expect(rollDice('s', 1)).not.toEqual(rollDice('s', 99));
  });

  it('spots doubles', () => {
    expect(isDoubles([4, 4])).toBe(true);
    expect(isDoubles([4, 5])).toBe(false);
  });
});

describe('the two pointers and the single exhaustion event', () => {
  const pointers = () => {
    const wall = buildWall('pointer-test');
    const breakIndex = breakPoint(0, [3, 4]);
    return {
      wall,
      drawIndex: breakIndex,
      flowerIndex: (breakIndex - 1 + WALL_SIZE) % WALL_SIZE,
      drawnFromWall: 0,
      giftsDrawn: 0,
    };
  };

  it('draws forward and gifts backward from the break', () => {
    const p = pointers();
    const breakIndex = p.drawIndex;
    expect(takeFromDrawWall(p)).toBe(p.wall[breakIndex]);
    expect(takeFromFlowerWall(p)).toBe(p.wall[(breakIndex - 1 + WALL_SIZE) % WALL_SIZE]);
    expect(wallRemaining(p)).toBe(142);
  });

  it('never hands out the same tile twice', () => {
    const p = pointers();
    const seen = new Set<string>();
    while (!wallExhausted(p)) {
      const fromDraw = takeFromDrawWall(p);
      if (fromDraw) {
        expect(seen.has(fromDraw.id)).toBe(false);
        seen.add(fromDraw.id);
      }
      const gift = takeFromFlowerWall(p);
      if (gift) {
        expect(seen.has(gift.id)).toBe(false);
        seen.add(gift.id);
      }
    }
    expect(seen.size).toBe(144);
  });

  it('exhausts exactly once, when the pointers cross', () => {
    const p = pointers();
    for (let i = 0; i < 100; i++) takeFromDrawWall(p);
    for (let i = 0; i < 44; i++) takeFromFlowerWall(p);
    expect(wallRemaining(p)).toBe(0);
    expect(wallExhausted(p)).toBe(true);
    expect(takeFromDrawWall(p)).toBeNull();
    expect(takeFromFlowerWall(p)).toBeNull();
  });
});
