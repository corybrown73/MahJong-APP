import type { SeatId } from '@bahay/engine';

export type Difficulty = 'tita' | 'kapitbahay' | 'lolo';

export type Personality = {
  id: Difficulty;
  name: string;
  /** One line the player sees on the table. */
  blurb: string;
  weights: {
    /** Shanten. Dominant term. */
    w1: number;
    /** Per live accepting tile. */
    w2: number;
    /** Ambition potential, when one is within reach. */
    w3: number;
    /** Danger: does this tile look like it feeds a visible wait? */
    w4: number;
  };
  /** Chance of simply not noticing a legal call. */
  missesCallChance: number;
  /** Thinking time, in milliseconds. Thinking time is a feature, not a delay. */
  thinkMs: [number, number];
  /** Folds a hopeless hand and plays defence instead. */
  foldsWhenHopeless: boolean;
  /** A slight bias that makes each seat memorable. */
  bias: 'flush' | 'aggressive' | 'safe';
};

export const TITA: Personality = {
  id: 'tita',
  name: 'Tita',
  blurb: 'Plays fast and cheerful. Chases whatever she just drew.',
  weights: { w1: 10, w2: 1.5, w3: 0, w4: 0 },
  missesCallChance: 0.3,
  thinkMs: [400, 900],
  foldsWhenHopeless: false,
  bias: 'aggressive',
};

export const KAPITBAHAY: Personality = {
  id: 'kapitbahay',
  name: 'Kapitbahay',
  blurb: 'Solid, steady neighbour. Takes most calls, sometimes over-chases.',
  weights: { w1: 10, w2: 1.5, w3: 2, w4: 3 },
  missesCallChance: 0.08,
  thinkMs: [500, 1200],
  foldsWhenHopeless: false,
  bias: 'flush',
};

export const LOLO: Personality = {
  id: 'lolo',
  name: 'Lolo',
  blurb: 'Forty years at this table. Counts your discards.',
  weights: { w1: 10, w2: 1.5, w3: 2, w4: 6 },
  missesCallChance: 0,
  thinkMs: [600, 1200],
  foldsWhenHopeless: true,
  bias: 'safe',
};

export const PERSONALITIES: Record<Difficulty, Personality> = {
  tita: TITA,
  kapitbahay: KAPITBAHAY,
  lolo: LOLO,
};

/** Default table: seat 0 is the human. */
export const DEFAULT_SEATING: Record<Exclude<SeatId, 0>, Difficulty> = {
  1: 'tita',
  2: 'lolo',
  3: 'kapitbahay',
};
