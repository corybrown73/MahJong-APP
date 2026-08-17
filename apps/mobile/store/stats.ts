import { create } from 'zustand';
import type { AmbitionId, SeatId, Settlement } from '@bahay/engine';
import { KEYS, loadJson, saveJson } from '../lib/storage';

export type Stats = {
  handsPlayed: number;
  handsWon: number;
  handsDrawn: number;
  chipsNet: number;
  bestHand: number;
  longestStreak: number;
  currentStreak: number;
  /** A collection grid — bisaklát is the rare one. */
  ambitions: Partial<Record<AmbitionId, number>>;
};

const EMPTY: Stats = {
  handsPlayed: 0,
  handsWon: 0,
  handsDrawn: 0,
  chipsNet: 0,
  bestHand: 0,
  longestStreak: 0,
  currentStreak: 0,
  ambitions: {},
};

type StatsStore = Stats & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  recordHand: (settlement: Settlement, youAre: SeatId) => void;
  reset: () => void;
};

export const useStats = create<StatsStore>((set, get) => ({
  ...EMPTY,
  hydrated: false,

  hydrate: async () => {
    const stats = await loadJson<Stats>(KEYS.stats, EMPTY);
    set({ ...stats, hydrated: true });
  },

  recordHand: (settlement, youAre) => {
    const current = get();
    const won = settlement.winner === youAre;
    const drawn = settlement.winner === null;
    const delta = settlement.transfers.reduce((n, transfer) => {
      if (transfer.to === youAre) return n + transfer.amount;
      if (transfer.from === youAre) return n - transfer.amount;
      return n;
    }, 0);

    const ambitions = { ...current.ambitions };
    if (won) {
      for (const item of settlement.items) {
        ambitions[item.ambition] = (ambitions[item.ambition] ?? 0) + 1;
      }
    }
    for (const payout of settlement.immediate) {
      if (payout.seat !== youAre) continue;
      ambitions[payout.ambition] = (ambitions[payout.ambition] ?? 0) + 1;
    }

    const currentStreak = won ? current.currentStreak + 1 : 0;
    const next: Stats = {
      handsPlayed: current.handsPlayed + 1,
      handsWon: current.handsWon + (won ? 1 : 0),
      handsDrawn: current.handsDrawn + (drawn ? 1 : 0),
      chipsNet: Math.round((current.chipsNet + delta) * 100) / 100,
      bestHand: won ? Math.max(current.bestHand, settlement.total) : current.bestHand,
      longestStreak: Math.max(current.longestStreak, currentStreak),
      currentStreak,
      ambitions,
    };
    set(next);
    void saveJson(KEYS.stats, next);
  },

  reset: () => {
    set({ ...EMPTY });
    void saveJson(KEYS.stats, EMPTY);
  },
}));
