/**
 * The table's clock.
 *
 * The engine holds the rules and has no notion of time; this store is where
 * time lives — AI thinking beats, the claim window, the call banner hold, and
 * the discard undo grace period. Everything it dispatches comes from
 * `legalActions`, and the only action it ever takes on the player's behalf is
 * PASS when their claim window expires.
 */

import { create } from 'zustand';
import {
  createGame,
  createRng,
  currentSeat,
  faceLabel,
  legalActions,
  nextHand as engineNextHand,
  publicView,
  reduce,
  reorderRack,
  seatsAwaitingClaimResponse,
  sortRack,
  type Action,
  type CallType,
  type GameState,
  type Ruleset,
  type SeatId,
  type Tile,
} from '@bahay/engine';
import { decide, PERSONALITIES, type Difficulty } from '@bahay/ai';
import { KEYS, loadJson, removeKey, saveJson } from '../lib/storage';
import { motion, speedMultiplier, type GameSpeed } from '../theme/tokens';
import { useSettings } from './settings';
import { useStats } from './stats';

export const HUMAN: SeatId = 0;

/** The beat between a win appearing and it being called for the player. */
const AUTO_WIN_MS = 700;

/** The house book's words for a call, used on the announcement banner. */
const CALL_HEADLINES: Record<CallType, string> = {
  chow: 'CHOW',
  pung: 'PONG',
  kang: 'KONG',
  todas: 'MAHJONGG',
};

export type Banner = {
  seat: SeatId;
  headline: string;
  detail: string;
};

export type SeatNames = Record<SeatId, string>;

type Saved = {
  state: GameState;
  difficulties: Record<string, Difficulty>;
  seed: string;
};

type GameStore = {
  state: GameState | null;
  seed: string;
  difficulties: Record<SeatId, Difficulty>;
  banner: Banner | null;
  /** Selected but not yet discarded — step one of the two-step discard. */
  selectedTileId: string | null;
  /** Confirmed but still inside the undo window. */
  pendingDiscard: { tileId: string; endsAt: number } | null;
  /** When the human's claim window closes, in epoch ms. */
  claimEndsAt: number | null;
  showHint: boolean;
  hasSavedGame: boolean;

  start: (options?: { seed?: string; ruleset?: Ruleset; difficulties?: Record<SeatId, Difficulty> }) => void;
  resume: () => Promise<boolean>;
  checkSaved: () => Promise<void>;
  abandon: () => void;

  dispatch: (action: Action) => void;
  selectTile: (tileId: string | null) => void;
  confirmDiscard: () => void;
  undoDiscard: () => void;
  claim: (call: CallType, tileIds: string[]) => void;
  pass: () => void;
  declareTodas: () => void;
  declareKang: (action: Action) => void;
  sortHand: () => void;
  moveTile: (from: number, to: number) => void;
  toggleHint: () => void;
  nextHand: () => void;
  dismissBanner: () => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;
let discardTimer: ReturnType<typeof setTimeout> | null = null;
let epoch = 0;
let bannerUntil = 0;
let recordedHand: string | null = null;

function clearTimers() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function scaled(ms: number, speed: GameSpeed): number {
  return Math.round(ms * speedMultiplier[speed]);
}

function defaultDifficulties(): Record<SeatId, Difficulty> {
  return { 0: 'kapitbahay', 1: 'tita', 2: 'lolo', 3: 'kapitbahay' };
}

export function seatNames(difficulties: Record<SeatId, Difficulty>): SeatNames {
  return {
    0: 'You',
    1: PERSONALITIES[difficulties[1]].name,
    2: PERSONALITIES[difficulties[2]].name,
    3: PERSONALITIES[difficulties[3]].name,
  };
}

export const useGame = create<GameStore>((set, get) => {
  /** Schedule whatever the table does next. Cancels anything already queued. */
  function advance() {
    clearTimers();
    const store = get();
    const state = store.state;
    if (!state) return;

    const speed = useSettings.getState().speed;
    const myEpoch = ++epoch;
    const hold = Math.max(0, bannerUntil - Date.now());

    if (state.phase.name === 'HAND_OVER') {
      const key = `${state.seed}:${state.handNumber}`;
      if (recordedHand !== key) {
        recordedHand = key;
        useStats.getState().recordHand(state.phase.settlement, HUMAN);
        void removeKey(KEYS.savedGame);
        set({ hasSavedGame: false });
      }
      return;
    }

    const waiting = seatsAwaitingClaimResponse(state);
    if (waiting.length > 0) {
      const ai = waiting.filter((seat) => seat !== HUMAN);
      if (ai.length > 0) {
        scheduleAi(ai[0], myEpoch, hold);
        return;
      }
      // A winning discard, and the player has asked us to take wins for them:
      // call it after a beat long enough to see which tile it was.
      const win = autoWin(state);
      if (win) {
        timer = setTimeout(() => {
          if (epoch !== myEpoch) return;
          get().dispatch(win);
        }, hold + scaled(AUTO_WIN_MS, speed));
        return;
      }
      // Only the player is left to answer: run a visible window, then pass for
      // them. Apart from taking a win when asked to, this is the only thing the
      // app ever does on their behalf.
      const windowMs = scaled(motion.claimWindow, speed);
      set({ claimEndsAt: Date.now() + hold + windowMs });
      timer = setTimeout(() => {
        if (epoch !== myEpoch) return;
        set({ claimEndsAt: null });
        get().dispatch({ type: 'PASS', seat: HUMAN });
      }, hold + windowMs);
      return;
    }

    set({ claimEndsAt: null });
    const seat = currentSeat(state);
    if (seat === null) return;

    if (seat !== HUMAN) {
      scheduleAi(seat, myEpoch, hold);
      return;
    }

    // Drawing is not a decision — take the tile after a short beat so the
    // player can see it arrive. Everything else waits for them.
    if (state.phase.name === 'AWAITING_DRAW') {
      timer = setTimeout(() => {
        if (epoch !== myEpoch) return;
        get().dispatch({ type: 'DRAW', seat: HUMAN });
      }, hold + scaled(260, speed));
      return;
    }

    // Drew the winning tile (or was dealt a win): declare it, after a beat so
    // the tile can be seen arriving.
    const win = autoWin(state);
    if (win) {
      timer = setTimeout(() => {
        if (epoch !== myEpoch) return;
        get().dispatch(win);
      }, hold + scaled(AUTO_WIN_MS, speed));
    }
  }

  /** The win to take for the player, if they have one and want it taken. */
  function autoWin(state: GameState): Action | null {
    if (!useSettings.getState().autoMahjongg) return null;
    return (
      legalActions(state, HUMAN).find(
        (a) => a.type === 'DECLARE_TODAS' || (a.type === 'CLAIM' && a.call === 'todas'),
      ) ?? null
    );
  }

  function scheduleAi(seat: SeatId, myEpoch: number, hold: number) {
    const store = get();
    const state = store.state;
    if (!state) return;
    const speed = useSettings.getState().speed;
    const options = legalActions(state, seat);
    if (options.length === 0) return;

    const personality = PERSONALITIES[store.difficulties[seat]];
    const rng = createRng(`${state.seed}:${state.handNumber}:${state.history.length}:${seat}`);
    const decision = decide(publicView(state, seat), options, personality, rng);

    timer = setTimeout(
      () => {
        if (epoch !== myEpoch) return;
        get().dispatch(decision.action);
      },
      hold + scaled(decision.thinkMs, speed),
    );
  }

  function bannerFor(state: GameState, names: SeatNames): Banner | null {
    for (const event of state.events) {
      if (event.type === 'CALLED') {
        const from = event.from === null ? '' : `from ${names[event.from].toLowerCase()}`;
        return {
          seat: event.seat,
          headline: CALL_HEADLINES[event.call],
          detail: `${describeTileShort(event.tile)} ${from}`.trim(),
        };
      }
      if (event.type === 'KANG_DECLARED') {
        const label = event.variant === 'secret' ? 'SECRET' : event.variant === 'sagasa' ? 'SAGASA' : 'KONG';
        return { seat: event.seat, headline: label, detail: faceLabel(event.face) };
      }
    }
    // A win off the wall is declared, not called, so it has no CALLED event.
    // It still deserves its moment before the scorecard.
    for (const event of state.events) {
      if (event.type === 'HAND_OVER' && event.settlement.winner !== null) {
        const { winner, winType } = event.settlement;
        if (winType === 'bunot' || winType === 'bisaklat') {
          return {
            seat: winner,
            headline: winType === 'bisaklat' ? 'BISAKLAT' : 'MAHJONGG',
            detail: winType === 'bisaklat' ? 'the dealt hand' : 'búnot — off the wall',
          };
        }
      }
    }
    return null;
  }

  function persist(state: GameState) {
    const store = get();
    void saveJson(KEYS.savedGame, {
      state,
      difficulties: store.difficulties,
      seed: store.seed,
    } satisfies Saved);
  }

  return {
    state: null,
    seed: '',
    difficulties: defaultDifficulties(),
    banner: null,
    selectedTileId: null,
    pendingDiscard: null,
    claimEndsAt: null,
    showHint: false,
    hasSavedGame: false,

    start: (options = {}) => {
      clearTimers();
      if (discardTimer) clearTimeout(discardTimer);
      const seed = options.seed ?? `hand-${Date.now()}`;
      const ruleset = options.ruleset ?? useSettings.getState().ruleset;
      const difficulties = options.difficulties ?? get().difficulties;
      recordedHand = null;
      bannerUntil = 0;
      const state = createGame({ seed, ruleset });
      set({
        state,
        seed,
        difficulties,
        banner: null,
        selectedTileId: null,
        pendingDiscard: null,
        claimEndsAt: null,
        hasSavedGame: true,
      });
      persist(state);
      advance();
    },

    checkSaved: async () => {
      const saved = await loadJson<Saved | null>(KEYS.savedGame, null as never);
      set({ hasSavedGame: !!saved?.state });
    },

    resume: async () => {
      const saved = await loadJson<Saved | null>(KEYS.savedGame, null as never);
      if (!saved?.state) return false;
      clearTimers();
      recordedHand = null;
      bannerUntil = 0;
      set({
        state: saved.state,
        seed: saved.seed,
        difficulties: (saved.difficulties as Record<SeatId, Difficulty>) ?? defaultDifficulties(),
        banner: null,
        selectedTileId: null,
        pendingDiscard: null,
        claimEndsAt: null,
        hasSavedGame: true,
      });
      advance();
      return true;
    },

    abandon: () => {
      clearTimers();
      if (discardTimer) clearTimeout(discardTimer);
      void removeKey(KEYS.savedGame);
      set({ state: null, hasSavedGame: false, banner: null, selectedTileId: null });
    },

    dispatch: (action) => {
      const store = get();
      if (!store.state) return;
      let next: GameState;
      try {
        next = reduce(store.state, action);
      } catch (error) {
        // The engine is the authority: an action it rejects is a bug in the
        // caller, not something to paper over silently at the table.
        if (__DEV__) console.warn('[bahay] rejected action', action, error);
        return;
      }

      const names = seatNames(store.difficulties);
      const banner = bannerFor(next, names);
      const speed = useSettings.getState().speed;
      if (banner) bannerUntil = Date.now() + scaled(motion.bannerHold, speed);

      set({
        state: next,
        banner: banner ?? store.banner,
        selectedTileId: null,
      });
      persist(next);
      advance();
    },

    selectTile: (tileId) => set({ selectedTileId: tileId }),

    confirmDiscard: () => {
      const store = get();
      const tileId = store.selectedTileId;
      if (!tileId || !store.state) return;
      const legal = legalActions(store.state, HUMAN).some(
        (a) => a.type === 'DISCARD' && a.tileId === tileId,
      );
      if (!legal) return;

      const { undoWindow, speed } = useSettings.getState();
      if (!undoWindow) {
        get().dispatch({ type: 'DISCARD', seat: HUMAN, tileId });
        return;
      }

      const windowMs = scaled(motion.undoWindow, speed);
      set({ pendingDiscard: { tileId, endsAt: Date.now() + windowMs } });
      if (discardTimer) clearTimeout(discardTimer);
      discardTimer = setTimeout(() => {
        const pending = get().pendingDiscard;
        if (!pending || pending.tileId !== tileId) return;
        set({ pendingDiscard: null });
        get().dispatch({ type: 'DISCARD', seat: HUMAN, tileId });
      }, windowMs);
    },

    undoDiscard: () => {
      if (discardTimer) clearTimeout(discardTimer);
      discardTimer = null;
      const pending = get().pendingDiscard;
      set({ pendingDiscard: null, selectedTileId: pending?.tileId ?? null });
    },

    claim: (call, tileIds) => get().dispatch({ type: 'CLAIM', seat: HUMAN, call, tileIds }),
    pass: () => get().dispatch({ type: 'PASS', seat: HUMAN }),
    declareTodas: () => get().dispatch({ type: 'DECLARE_TODAS', seat: HUMAN }),
    declareKang: (action) => get().dispatch(action),

    sortHand: () => {
      const state = get().state;
      if (!state) return;
      set({ state: sortRack(state, HUMAN) });
    },

    moveTile: (from, to) => {
      const state = get().state;
      if (!state) return;
      set({ state: reorderRack(state, HUMAN, from, to) });
    },

    toggleHint: () => set({ showHint: !get().showHint }),

    nextHand: () => {
      const state = get().state;
      if (!state || state.phase.name !== 'HAND_OVER') return;
      clearTimers();
      recordedHand = null;
      bannerUntil = 0;
      const next = engineNextHand(state);
      set({
        state: next,
        banner: null,
        selectedTileId: null,
        pendingDiscard: null,
        claimEndsAt: null,
        hasSavedGame: true,
      });
      persist(next);
      advance();
    },

    dismissBanner: () => set({ banner: null }),
  };
});

function describeTileShort(tile: Tile): string {
  if (tile.kind === 'flower') return tile.face;
  const names = { balls: 'bolá', sticks: 'kahoy', chars: 'letra' } as const;
  return `${tile.rank} ${names[tile.suit]}`;
}

/** Everything the human seat may legally do right now. */
export function humanOptions(state: GameState | null): Action[] {
  if (!state) return [];
  return legalActions(state, HUMAN);
}
