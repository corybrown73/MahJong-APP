import { create } from 'zustand';
import { cloneRuleset, normalizeRuleset, STANDARD, type Ruleset } from '@bahay/engine';
import { KEYS, loadJson, saveJson } from '../lib/storage';
import type { GameSpeed } from '../theme/tokens';

export type Language = 'en' | 'tl';

export type Settings = {
  /** Relaxed by default: slow enough to learn from. */
  speed: GameSpeed;
  /** Off by default. Announcements are visual first. */
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  /** Multiplier on rack tile size, for eyes and thumbs of every age. */
  tileScale: number;
  language: Language;
  /** Highlights what you are waiting on and flags dangerous discards. */
  coachMode: boolean;
  /** Two-step discard is always on; this controls the undo grace period. */
  undoWindow: boolean;
  /**
   * Playing alone, take every win the moment it is there — a winning discard
   * or a winning draw — rather than risk the claim window running out. On by
   * default; turn it off to hold out for a bigger hand.
   */
  autoMahjongg: boolean;
};

const DEFAULTS: Settings = {
  speed: 'relaxed',
  sound: false,
  haptics: true,
  reducedMotion: false,
  highContrast: false,
  tileScale: 1,
  language: 'en',
  coachMode: false,
  undoWindow: true,
  autoMahjongg: true,
};

type SettingsStore = Settings & {
  ruleset: Ruleset;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setRuleset: (ruleset: Ruleset) => void;
};

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  ruleset: cloneRuleset(STANDARD),
  hydrated: false,

  hydrate: async () => {
    const [settings, storedRuleset] = await Promise.all([
      loadJson<Settings>(KEYS.settings, DEFAULTS),
      loadJson<Partial<Ruleset> | null>(KEYS.ruleset, null),
    ]);
    // A config saved by an older build gains any newly added options here.
    // Settings saved by an older build gain any newly added options from the
    // defaults, rather than reading them as off.
    set({ ...DEFAULTS, ...settings, ruleset: normalizeRuleset(storedRuleset), hydrated: true });
  },

  set: (key, value) => {
    set({ [key]: value } as Partial<SettingsStore>);
    const { ruleset, hydrated, hydrate, set: _set, setRuleset, ...rest } = get();
    void saveJson(KEYS.settings, { ...rest, [key]: value });
  },

  setRuleset: (ruleset) => {
    set({ ruleset });
    void saveJson(KEYS.ruleset, ruleset);
  },
}));

export function settingsSnapshot(store: SettingsStore): Settings {
  const { ruleset, hydrated, hydrate, set, setRuleset, ...rest } = store;
  return rest;
}
