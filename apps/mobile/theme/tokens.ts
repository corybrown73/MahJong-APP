/**
 * Báhay's visual language: warm, tactile, domestic — the felt of a family
 * table under a kitchen light, not a casino and not an anime lobby.
 */

export const colors = {
  feltDeep: '#14392B',
  felt: '#1B5B45',
  feltLight: '#2A7A5C',
  tileFace: '#F7F1E3',
  tileEdge: '#E0D6BE',
  tileShadow: '#C9BEA2',
  tileBack: '#2C6E63',
  tileBackDark: '#215750',
  tileBackLight: '#3A8478',
  ink: '#1A1613',
  inkSoft: '#6B6156',
  vermilion: '#C8412F',
  jade: '#2E7D5B',
  indigo: '#2B4C7E',
  gold: '#D4A24C',
  goldGlow: '#F0C97A',
  capiz: '#FFFDF7',
} as const;

/**
 * High contrast darkens the felt and pushes the engraving colours darker, for
 * players who need it. Mahjong skews older; this is not optional.
 */
export type Palette = { readonly [K in keyof typeof colors]: string };

export const highContrastColors: Palette = {
  ...colors,
  feltDeep: '#0A2119',
  felt: '#103A2C',
  feltLight: '#1B5B45',
  tileFace: '#FFFDF4',
  ink: '#000000',
  vermilion: '#A82A1A',
  jade: '#12603F',
  indigo: '#152F58',
};

export const type = {
  display: 'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
} as const;

/** Nothing below 16pt; tile ranks never below 22pt. */
export const fontSize = {
  micro: 11,
  small: 13,
  body: 16,
  large: 20,
  title: 26,
  display: 34,
  huge: 48,
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
  tile: 8,
  card: 14,
  sheet: 20,
  pill: 999,
} as const;

/** Every duration scales with the game-speed setting; the default is Relaxed. */
export const motion = {
  tileDraw: 280,
  discard: 340,
  meldExposure: 420,
  meldStagger: 60,
  bannerIn: 200,
  bannerHold: 900,
  bannerOut: 200,
  winReveal: 600,
  settlementLine: 120,
  claimWindow: 2500,
  undoWindow: 1500,
} as const;

export const speedMultiplier = {
  relaxed: 1,
  normal: 0.7,
  fast: 0.45,
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
