import type { AmbitionId, JaiAlaiRules, Ruleset } from './types.js';

export type AmbitionDef = {
  id: AmbitionId;
  label: string;
  filipino?: string;
  /** Plain-language explanation, shown on the House Rules screen. */
  description: string;
  kind: 'base' | 'multiplier' | 'hand' | 'immediate';
  defaultValue: number;
  /** Ambitions that cannot be scored alongside this one. See §5.9. */
  conflicts: AmbitionId[];
};

export const AMBITIONS: AmbitionDef[] = [
  {
    id: 'todas',
    label: 'Base win',
    filipino: 'Tódas',
    description: 'Five báhay and an eye.',
    kind: 'base',
    defaultValue: 1,
    conflicts: [],
  },
  {
    id: 'bunot',
    label: 'Self-drawn',
    filipino: 'Búnot',
    description: 'You drew the winning tile yourself. Doubles the whole payout.',
    kind: 'multiplier',
    defaultValue: 2,
    conflicts: [],
  },
  {
    id: 'escalera',
    label: 'Escaléra',
    filipino: 'Escaléra',
    description: '1 through 9 of one suit — three chows spanning the full run.',
    kind: 'hand',
    defaultValue: 0.5,
    conflicts: ['sietePares'],
  },
  {
    id: 'sietePares',
    label: 'Siete Pares',
    filipino: 'Siete Pares',
    description: 'Seven pairs plus one báhay.',
    kind: 'hand',
    defaultValue: 0.5,
    conflicts: ['escalera', 'allPungs'],
  },
  {
    id: 'fullFlush',
    label: 'Full flush',
    description: 'Every tile in one suit.',
    kind: 'hand',
    defaultValue: 0.5,
    conflicts: [],
  },
  {
    id: 'allPungs',
    label: 'All pungs',
    description: 'No chows anywhere in the hand.',
    kind: 'hand',
    defaultValue: 0.25,
    conflicts: ['allChows', 'sietePares'],
  },
  {
    id: 'allChows',
    label: 'All chows',
    description: 'No pungs and no kangs.',
    kind: 'hand',
    defaultValue: 0.25,
    conflicts: ['allPungs'],
  },
  {
    id: 'concealedHand',
    label: 'Concealed hand',
    description: 'Nothing exposed when you won. A secret kang still counts as concealed.',
    kind: 'hand',
    defaultValue: 0.25,
    conflicts: ['allRevealed'],
  },
  {
    id: 'allRevealed',
    label: 'All revealed',
    description: 'Every set exposed on the table.',
    kind: 'hand',
    defaultValue: 0.25,
    conflicts: ['concealedHand'],
  },
  {
    id: 'quickWin',
    label: 'Quick win',
    description: 'Won inside the first few discards of the hand.',
    kind: 'hand',
    defaultValue: 0.25,
    conflicts: [],
  },
  {
    id: 'paningit',
    label: 'Paníngit',
    filipino: 'Paníngit',
    description: 'Won on the middle tile of a chow — holding 4 and 6, winning on 5.',
    kind: 'hand',
    defaultValue: 0.25,
    conflicts: ['singleWait', 'backToBack'],
  },
  {
    id: 'singleWait',
    label: 'Single wait',
    description: 'Won on the eye, or on an edge wait (1-2 waiting on 3, 8-9 waiting on 7).',
    kind: 'hand',
    defaultValue: 0.25,
    conflicts: ['paningit', 'backToBack'],
  },
  {
    id: 'backToBack',
    label: 'Back to back',
    description: 'Waiting on either of two pairs to become the winning set.',
    kind: 'hand',
    defaultValue: 0.25,
    conflicts: ['paningit', 'singleWait'],
  },
  {
    id: 'bisaklat',
    label: 'Bisaklát',
    filipino: 'Bisaklát',
    description: "The máno's dealt hand is already a winning hand. Ends the hand instantly.",
    kind: 'hand',
    defaultValue: 20,
    conflicts: [],
  },
  {
    id: 'openKang',
    label: 'Open kang',
    description: 'Kang claimed from a discard. Paid immediately by everyone.',
    kind: 'immediate',
    defaultValue: 0.25,
    conflicts: [],
  },
  {
    id: 'secretKang',
    label: 'Secret',
    filipino: 'Secret',
    description: 'A concealed four-of-a-kind. Paid immediately by everyone.',
    kind: 'immediate',
    defaultValue: 0.5,
    conflicts: [],
  },
  {
    id: 'sagasa',
    label: 'Sagása',
    filipino: 'Sagása',
    description: 'You drew the fourth tile matching your own exposed pung.',
    kind: 'immediate',
    defaultValue: 0.5,
    conflicts: [],
  },
  {
    id: 'noFlowers',
    label: 'No flowers',
    description: 'Dealt zero flowers. Pays again if you win having still drawn none.',
    kind: 'immediate',
    defaultValue: 0.25,
    conflicts: [],
  },
  {
    id: 'thirteenFlowers',
    label: 'Thirteen flowers',
    description: 'Accumulated thirteen flower tiles in one hand.',
    kind: 'immediate',
    defaultValue: 0.25,
    conflicts: [],
  },
];

export const AMBITION_BY_ID: Record<AmbitionId, AmbitionDef> = Object.fromEntries(
  AMBITIONS.map((a) => [a.id, a]),
) as Record<AmbitionId, AmbitionDef>;

export function defaultAmbitionValues(): Record<AmbitionId, number> {
  return Object.fromEntries(AMBITIONS.map((a) => [a.id, a.defaultValue])) as Record<
    AmbitionId,
    number
  >;
}

/**
 * Talbog 1, búnot 2, bisaklát 2, and a major ambition +1 — so each of the
 * classic "majors" (siete pares, total pong, escaléra) lands on 2 markers,
 * matching búnot. The majors list is the table's to edit.
 */
export function defaultJaiAlai(): JaiAlaiRules {
  return {
    enabled: false,
    ante: 0.25,
    markersToWin: 5,
    markerAwards: { win: 1, bunot: 2, bisaklat: 2, ambitionBonus: 1 },
    majors: ['sietePares', 'allPungs', 'escalera'],
  };
}

export const STANDARD: Ruleset = {
  id: 'standard',
  label: 'Standard',
  jokerEnabled: true,
  doublesOnDoubleRoll: true,
  robbingTheKang: true,
  chowFromAnyPlayer: false,
  multipleWinnersOnDiscard: false,
  sieteParesRequiresConcealed: false,
  quickWinDiscardLimit: 5,
  bisaklatValue: 20,
  drawEndsDealership: false,
  roundsPerGame: 4,
  thirteenFlowersThreshold: 13,
  bisaklatStacksAmbitions: false,
  jaiAlai: defaultJaiAlai(),
  ambitionValues: defaultAmbitionValues(),
};

/**
 * A common Visayan variation: no joker, chow from anyone, siete pares
 * concealed, and no thirteen-flowers payout (their sets carry fewer flowers).
 */
export const VISAYAN: Ruleset = {
  ...STANDARD,
  id: 'visayan',
  label: 'Visayan',
  jokerEnabled: false,
  chowFromAnyPlayer: true,
  sieteParesRequiresConcealed: true,
  thirteenFlowersThreshold: 0,
  jaiAlai: defaultJaiAlai(),
  ambitionValues: { ...defaultAmbitionValues(), thirteenFlowers: 0 },
};

/** The editable preset — "how our house plays". */
export const HOUSE: Ruleset = {
  ...STANDARD,
  id: 'house',
  label: 'Our House',
  jaiAlai: defaultJaiAlai(),
  ambitionValues: defaultAmbitionValues(),
};

export const PRESETS: Ruleset[] = [STANDARD, VISAYAN, HOUSE];

export function ambitionValue(ruleset: Ruleset, id: import('./types.js').AmbitionId): number {
  const override = ruleset.ambitionValues[id];
  return override === undefined ? AMBITION_BY_ID[id].defaultValue : override;
}

export function cloneRuleset(ruleset: Ruleset): Ruleset {
  return {
    ...ruleset,
    jaiAlai: {
      ...ruleset.jaiAlai,
      markerAwards: { ...ruleset.jaiAlai.markerAwards },
      majors: [...ruleset.jaiAlai.majors],
    },
    ambitionValues: { ...ruleset.ambitionValues },
  };
}

/**
 * Fill anything missing from an older stored ruleset with the standard
 * defaults, so a saved config survives the app gaining new options.
 */
export function normalizeRuleset(stored: Partial<Ruleset> | null | undefined): Ruleset {
  const base = cloneRuleset(STANDARD);
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    jaiAlai: {
      ...base.jaiAlai,
      ...(stored.jaiAlai ?? {}),
      markerAwards: { ...base.jaiAlai.markerAwards, ...(stored.jaiAlai?.markerAwards ?? {}) },
      majors: stored.jaiAlai?.majors ?? base.jaiAlai.majors,
    },
    ambitionValues: { ...base.ambitionValues, ...(stored.ambitionValues ?? {}) },
  };
}
