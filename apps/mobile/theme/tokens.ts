/**
 * Báhay — the parlor edition.
 *
 * Three Filipino materials carry the whole identity:
 *
 *   narra   — the national hardwood, warm red-brown, the rim of the table
 *   capiz   — the pearly window shell, every piece of light text
 *   brass   — the fittings: buttons, rules, the glow on whoever is acting
 *
 * set against black lacquer and an emerald baize, like an automatic table in a
 * good room. Saturated colour is reserved for the three suits engraved on the
 * tiles, so the tiles are always the brightest thing on screen.
 */

export const colors = {
  // The room
  night: '#0C0907',
  lacquer: '#15100D',
  lacquerLight: '#221A15',
  lacquerEdge: '#3A2C22',

  // The table
  narra: '#6E2F1B',
  narraLight: '#9A4A2C',
  narraDark: '#3A160C',
  feltDeep: '#062A24',
  felt: '#0B4A3F',
  feltLight: '#147060',

  // Fittings
  gold: '#C9A15A',
  goldGlow: '#EFD08F',
  brassDark: '#7D5E28',
  led: '#FFB547',

  // Tiles: bone-white faces on a jade back
  tileFace: '#FBF6EA',
  tileEdge: '#E6DCC6',
  tileShadow: '#B9AC8E',
  tileBack: '#17705B',
  tileBackDark: '#0C4A3B',
  tileBackLight: '#2C937A',

  // Engraving — the only saturated hues in the app
  ink: '#1A1411',
  inkSoft: '#6E6255',
  vermilion: '#C23B22',
  jade: '#1D7A4C',
  indigo: '#22407A',

  capiz: '#F4EEE3',
} as const;

/**
 * High contrast deepens the room and darkens the engraving, for players who
 * need it. Mahjong skews older; this is not optional.
 */
export type Palette = { readonly [K in keyof typeof colors]: string };

export const highContrastColors: Palette = {
  ...colors,
  night: '#000000',
  lacquer: '#070504',
  feltDeep: '#021A16',
  felt: '#063329',
  tileFace: '#FFFFFF',
  ink: '#000000',
  vermilion: '#A3200A',
  jade: '#0B5A33',
  indigo: '#0F2A5C',
  gold: '#E2BA6C',
};

export const type = {
  /** Fraunces: a soft, warm serif for headings and every numeral on a tile. */
  display: 'Fraunces_700Bold',
  displaySemi: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_400Regular_Italic',
  /** Inter for reading, set in caps for labels. */
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  label: 'Inter_600SemiBold',
} as const;

/** Nothing below 16pt for reading text; labels may go to 11. */
export const fontSize = {
  micro: 11,
  small: 13,
  body: 16,
  large: 20,
  title: 26,
  display: 38,
  huge: 52,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  tile: 6,
  card: 16,
  sheet: 22,
  pill: 999,
} as const;

/** Every duration scales with the game-speed setting; the default is Relaxed. */
export const motion = {
  tileDraw: 280,
  discard: 340,
  meldExposure: 420,
  meldStagger: 60,
  bannerIn: 200,
  bannerHold: 1000,
  bannerOut: 200,
  /** How long a win is announced on the table before the scorecard comes up. */
  winReveal: 1400,
  settlementLine: 120,
  claimWindow: 3000,
  undoWindow: 1100,
} as const;

/**
 * Relaxed — the default — gives a 4.2s claim window and lets the house take a
 * second or more over each move, so every discard can be followed.
 */
export const speedMultiplier = {
  relaxed: 1.4,
  normal: 1,
  fast: 0.6,
} as const;

export type GameSpeed = keyof typeof speedMultiplier;

/** Suit colours are the only saturated hues on screen. */
export function suitColor(suit: 'balls' | 'sticks' | 'chars', palette: Palette = colors): string {
  switch (suit) {
    case 'balls':
      return palette.vermilion;
    case 'sticks':
      return palette.jade;
    case 'chars':
      return palette.indigo;
  }
}

/** Dark ink for text set on brass. */
export const onBrass = '#2A1C08';
