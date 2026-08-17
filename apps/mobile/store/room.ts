/**
 * The online table.
 *
 * This store holds no authority at all: it forwards commands to a transport
 * and renders whatever filtered view comes back. The two-step discard and the
 * undo window live here because they are interface, not rules — everything
 * else, including whose turn it is and when a claim window closes, is the
 * server's to decide.
 */

import { create } from 'zustand';
import type { Action, CallType, Ruleset, SeatId } from '@bahay/engine';
import { legalActions, publicView, reduce } from '@bahay/engine';
import type { RoomCommand, RoomView } from '@bahay/room';
import type { Difficulty } from '@bahay/ai';
import { getIdentity } from '../lib/identity';
import { LocalTransport, type RoomTransport, type TransportStatus } from '../lib/transport';
import {
  createOnlineRoom,
  onlinePlayAvailable,
  SupabaseTransport,
} from '../lib/supabaseTransport';
import { motion, speedMultiplier } from '../theme/tokens';
import { useSettings } from './settings';
import { useStats } from './stats';
import type { Banner } from './game';

/** The house book's words for a call, used on the announcement banner. */
const CALL_HEADLINES: Record<CallType, string> = {
  chow: 'CHOW',
  pung: 'PONG',
  kang: 'KONG',
  todas: 'MAHJONGG',
};

type RoomStore = {
  view: RoomView | null;
  status: TransportStatus;
  transport: RoomTransport | null;
  banner: Banner | null;
  selectedTileId: string | null;
  pendingDiscard: { tileId: string } | null;
  showHint: boolean;
  starting: boolean;
  joinError: string | null;

  hostLocal: (ruleset?: Ruleset) => Promise<void>;
  hostOnline: (ruleset: Ruleset) => Promise<string | null>;
  joinOnline: (code: string) => Promise<boolean>;
  leave: () => void;

  fillSeat: (seat: SeatId, difficulty: Difficulty) => void;
  openSeat: (seat: SeatId) => void;
  sit: (seat: SeatId) => void;
  start: () => void;
  nextHand: () => void;

  selectTile: (tileId: string | null) => void;
  confirmDiscard: () => void;
  undoDiscard: () => void;
  claim: (call: CallType, tileIds: string[]) => void;
  pass: () => void;
  declare: (action: Action) => void;
  sortHand: () => void;
  moveTile: (from: number, to: number) => void;
  toggleHint: () => void;
  dismissBanner: () => void;
};

let unsubscribe: (() => void) | null = null;
let discardTimer: ReturnType<typeof setTimeout> | null = null;
let lastEventAt = 0;
let recordedHand: string | null = null;

export const useRoom = create<RoomStore>((set, get) => {
  /**
   * The rack's order is the player's business, not the table's, so it is kept
   * on the client and re-applied over whatever the server sends.
   */
  let rackOrder: string[] = [];

  function applyRackOrder(view: RoomView): RoomView {
    if (!view.game || rackOrder.length === 0) return view;
    const byId = new Map(view.game.hand.map((tile) => [tile.id, tile]));
    const ordered = rackOrder.map((id) => byId.get(id)).filter((tile) => tile !== undefined);
    const rest = view.game.hand.filter((tile) => !rackOrder.includes(tile.id));
    const hand = [...ordered, ...rest] as typeof view.game.hand;
    if (hand.length !== view.game.hand.length) return view;
    return { ...view, game: { ...view.game, hand } };
  }

  function bannerFrom(view: RoomView): Banner | null {
    const speed = useSettings.getState().speed;
    const hold = motion.bannerHold * speedMultiplier[speed];
    for (const event of view.events) {
      if (event.at <= lastEventAt) continue;
      if (event.type !== 'GAME') continue;
      const action = event.action;
      if (action.type === 'CLAIM') {
        lastEventAt = event.at;
        return {
          seat: event.seat,
          headline: CALL_HEADLINES[action.call],
          detail: view.seats[event.seat]?.name ?? '',
        };
      }
      if (action.type === 'SECRET_KANG' || action.type === 'SAGASA') {
        lastEventAt = event.at;
        return {
          seat: event.seat,
          headline: action.type === 'SAGASA' ? 'SAGASA' : 'SECRET',
          detail: view.seats[event.seat]?.name ?? '',
        };
      }
      lastEventAt = Math.max(lastEventAt, event.at);
    }
    void hold;
    return null;
  }

  function attach(transport: RoomTransport): void {
    unsubscribe?.();
    unsubscribe = transport.subscribe((incoming, status) => {
      const view = applyRackOrder(incoming);
      const banner = bannerFrom(view) ?? get().banner;

      // Record the hand for stats once, when it settles.
      if (view.settlement && view.yourSeat !== null && view.game) {
        const key = `${view.code}:${view.game.handNumber}`;
        if (recordedHand !== key) {
          recordedHand = key;
          useStats.getState().recordHand(view.settlement, view.yourSeat);
        }
      }
      if (!view.settlement) recordedHand = null;

      set({ view, status, banner });
    });
    set({ transport });
  }

  async function command(partial: Omit<RoomCommand, 'at' | 'playerId'>): Promise<void> {
    const transport = get().transport;
    if (!transport) return;
    const identity = await getIdentity();
    await transport.send({
      ...(partial as object),
      playerId: identity.playerId,
      at: Date.now(),
    } as RoomCommand);
  }

  return {
    view: null,
    status: { connection: 'connecting', error: null },
    transport: null,
    banner: null,
    selectedTileId: null,
    pendingDiscard: null,
    showHint: false,
    starting: false,
    joinError: null,

    hostLocal: async (ruleset) => {
      get().leave();
      const identity = await getIdentity();
      const transport = new LocalTransport({
        playerId: identity.playerId,
        name: identity.name,
        ruleset: ruleset ?? useSettings.getState().ruleset,
      });
      rackOrder = [];
      recordedHand = null;
      lastEventAt = 0;
      attach(transport);
    },

    hostOnline: async (ruleset) => {
      if (!onlinePlayAvailable()) {
        set({ joinError: 'Online play is not configured in this build.' });
        return null;
      }
      get().leave();
      const identity = await getIdentity();
      const created = await createOnlineRoom({
        playerId: identity.playerId,
        name: identity.name,
        ruleset,
      });
      if ('error' in created) {
        set({ joinError: created.error });
        return null;
      }
      rackOrder = [];
      recordedHand = null;
      lastEventAt = 0;
      attach(
        new SupabaseTransport({
          code: created.code,
          playerId: identity.playerId,
          name: identity.name,
        }),
      );
      set({ joinError: null });
      return created.code;
    },

    joinOnline: async (code) => {
      if (!onlinePlayAvailable()) {
        set({ joinError: 'Online play is not configured in this build.' });
        return false;
      }
      get().leave();
      const identity = await getIdentity();
      rackOrder = [];
      recordedHand = null;
      lastEventAt = 0;
      const transport = new SupabaseTransport({
        code: code.trim().toUpperCase(),
        playerId: identity.playerId,
        name: identity.name,
      });
      attach(transport);
      await transport.send({
        type: 'JOIN',
        playerId: identity.playerId,
        name: identity.name,
        at: Date.now(),
      });
      const status = get().status;
      if (status.error) {
        set({ joinError: status.error });
        return false;
      }
      set({ joinError: null });
      return true;
    },

    leave: () => {
      if (discardTimer) clearTimeout(discardTimer);
      discardTimer = null;
      unsubscribe?.();
      unsubscribe = null;
      get().transport?.dispose();
      set({
        transport: null,
        view: null,
        banner: null,
        selectedTileId: null,
        pendingDiscard: null,
      });
    },

    fillSeat: (seat, difficulty) => void command({ type: 'FILL_SEAT', seat, difficulty } as never),
    openSeat: (seat) => void command({ type: 'OPEN_SEAT', seat } as never),
    sit: (seat) => void command({ type: 'SIT', seat } as never),
    start: () => {
      set({ starting: true });
      void command({ type: 'START' } as never).finally(() => set({ starting: false }));
    },
    nextHand: () => void command({ type: 'NEXT_HAND' } as never),

    selectTile: (tileId) => set({ selectedTileId: tileId }),

    confirmDiscard: () => {
      const { view, selectedTileId } = get();
      if (!view?.game || !selectedTileId || view.yourSeat === null) return;
      const seat = view.yourSeat;
      const send = () => {
        set({ pendingDiscard: null, selectedTileId: null });
        void command({
          type: 'GAME_ACTION',
          action: { type: 'DISCARD', seat, tileId: selectedTileId },
        } as never);
      };

      const { undoWindow, speed } = useSettings.getState();
      if (!undoWindow) {
        send();
        return;
      }
      set({ pendingDiscard: { tileId: selectedTileId } });
      if (discardTimer) clearTimeout(discardTimer);
      discardTimer = setTimeout(send, motion.undoWindow * speedMultiplier[speed]);
    },

    undoDiscard: () => {
      if (discardTimer) clearTimeout(discardTimer);
      discardTimer = null;
      const pending = get().pendingDiscard;
      set({ pendingDiscard: null, selectedTileId: pending?.tileId ?? null });
    },

    claim: (call, tileIds) => {
      const seat = get().view?.yourSeat;
      if (seat === null || seat === undefined) return;
      void command({ type: 'GAME_ACTION', action: { type: 'CLAIM', seat, call, tileIds } } as never);
    },

    pass: () => {
      const seat = get().view?.yourSeat;
      if (seat === null || seat === undefined) return;
      void command({ type: 'GAME_ACTION', action: { type: 'PASS', seat } } as never);
    },

    declare: (action) => void command({ type: 'GAME_ACTION', action } as never),

    sortHand: () => {
      const view = get().view;
      if (!view?.game) return;
      const sorted = [...view.game.hand].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      rackOrder = sorted.map((tile) => tile.id);
      set({ view: { ...view, game: { ...view.game, hand: sorted } } });
    },

    moveTile: (from, to) => {
      const view = get().view;
      if (!view?.game) return;
      const hand = [...view.game.hand];
      if (from < 0 || from >= hand.length || to < 0 || to >= hand.length) return;
      const [moved] = hand.splice(from, 1);
      hand.splice(to, 0, moved);
      rackOrder = hand.map((tile) => tile.id);
      set({ view: { ...view, game: { ...view.game, hand } } });
    },

    toggleHint: () => set({ showHint: !get().showHint }),
    dismissBanner: () => set({ banner: null }),
  };
});

function sortKey(tile: { kind: string; suit?: string; rank?: number; face?: string }): string {
  if (tile.kind !== 'suited') return `9-${tile.face}`;
  const order = { balls: 0, sticks: 1, chars: 2 } as Record<string, number>;
  return `${order[tile.suit ?? ''] ?? 3}-${String(tile.rank).padStart(2, '0')}`;
}

/**
 * What this player may legally do. The server is the authority, but the client
 * needs the same answer to light the call bar — so it recomputes it from its
 * own filtered view rather than waiting for a round trip.
 */
export function legalForView(view: RoomView | null): Action[] {
  if (!view?.game || view.yourSeat === null) return [];
  const phase = view.game.phase;
  const seat = view.yourSeat;

  // Reconstruct just enough state for legalActions: our own hand is real, the
  // other seats are opaque, and no rule the player can act on depends on them.
  try {
    const shadow = shadowState(view, seat);
    return legalActions(shadow, seat);
  } catch {
    void phase;
    return [];
  }
}

/**
 * A GameState stand-in built from the public view. Other players' concealed
 * tiles are unknown here — and unknowable — so they are filled with
 * placeholders that only carry the right count.
 */
function shadowState(view: RoomView, seat: SeatId) {
  const game = view.game!;
  const players = ([0, 1, 2, 3] as SeatId[]).map((id) => {
    const player = game.players[id];
    return {
      seat: id,
      concealed:
        id === seat
          ? game.hand
          : Array.from({ length: player.concealedCount }, (_, i) => ({
              kind: 'flower' as const,
              group: 'season' as const,
              face: 'hidden',
              id: `hidden-${id}-${i}`,
            })),
      melds: player.melds,
      flowers: player.flowers,
      isDealer: player.isDealer,
      chips: player.chips,
      everDrewFlower: true,
    };
  });

  return {
    seed: view.code,
    ruleset: game.ruleset,
    wall: [],
    breakIndex: 0,
    drawIndex: 0,
    flowerIndex: 0,
    // The engine refuses a kang with no gift tile left; keep that honest by
    // carrying the real remaining count over from the view.
    drawnFromWall: 144 - game.tilesRemaining,
    giftsDrawn: 0,
    dice: [1, 1] as [number, number],
    joker: game.joker,
    players,
    discards: game.discards,
    phase: game.phase,
    round: game.round,
    handNumber: game.handNumber,
    dealerSeat: game.dealerSeat,
    doublesActive: game.doublesActive,
    markers: game.markers,
    pot: game.pot,
    immediate: [],
    history: [],
    events: [],
    pendingKang: null,
  } as unknown as Parameters<typeof legalActions>[0];
}

export { publicView, reduce };
