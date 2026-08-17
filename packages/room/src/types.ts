/**
 * Rooms — the layer above the engine that lets four people at three addresses
 * play one hand.
 *
 * The engine is deterministic and clock-free; a room is where seats, identity
 * and wall-clock time live. This module is still pure: `applyCommand` is
 * `(room, command) -> room`, so the same code runs inside a Supabase Edge
 * Function, inside a Node room server, or in the app itself for solo play.
 */

import type {
  Action,
  GameState,
  PublicGameView,
  Ruleset,
  SeatId,
  Settlement,
} from '@bahay/engine';
import type { Difficulty } from '@bahay/ai';

export type PlayerId = string;

export type Occupant =
  | {
      kind: 'human';
      playerId: PlayerId;
      name: string;
      connected: boolean;
      /** Wall-clock of the last thing we heard from them. */
      lastSeenAt: number;
    }
  | { kind: 'ai'; difficulty: Difficulty; name: string }
  | { kind: 'open' };

export type RoomStatus = 'lobby' | 'playing' | 'over';

export type Room = {
  code: string;
  hostId: PlayerId;
  ruleset: Ruleset;
  seats: [Occupant, Occupant, Occupant, Occupant];
  status: RoomStatus;
  game: GameState | null;
  seed: string;
  /** Bumped on every accepted command, so clients can order and dedupe. */
  version: number;
  createdAt: number;
  updatedAt: number;
  /**
   * When the table entered the state it is now waiting in. Every deadline is
   * measured from here rather than from "now", so a heartbeat can never push
   * its own deadline out of reach.
   */
  phaseSince: number;
  /**
   * Identifies what the table is waiting on. A claim window keeps one key for
   * its whole life, so another seat answering never restarts the clock on
   * somebody still deciding.
   */
  phaseKey: string;
  /** When the open claim window closes. The server passes for whoever is late. */
  claimDeadline: number | null;
  /** When the next automatic action (an AI move, a draw) is due. */
  nextActionAt: number | null;
  /** Recent events, for clients to announce and animate. Trimmed. */
  events: RoomEvent[];
};

export type RoomEvent =
  | { type: 'JOINED'; seat: SeatId; name: string; at: number }
  | { type: 'LEFT'; seat: SeatId; name: string; at: number }
  | { type: 'RECONNECTED'; seat: SeatId; name: string; at: number }
  | { type: 'SEAT_FILLED'; seat: SeatId; name: string; at: number }
  | { type: 'STARTED'; at: number }
  | { type: 'HAND_OVER'; settlement: Settlement; at: number }
  | { type: 'GAME'; seat: SeatId; action: Action; at: number };

export type RoomCommand =
  | { type: 'JOIN'; playerId: PlayerId; name: string; at: number }
  | { type: 'LEAVE'; playerId: PlayerId; at: number }
  | { type: 'SIT'; playerId: PlayerId; seat: SeatId; at: number }
  | { type: 'FILL_SEAT'; playerId: PlayerId; seat: SeatId; difficulty: Difficulty; at: number }
  | { type: 'OPEN_SEAT'; playerId: PlayerId; seat: SeatId; at: number }
  | { type: 'SET_RULESET'; playerId: PlayerId; ruleset: Ruleset; at: number }
  | { type: 'START'; playerId: PlayerId; at: number }
  | { type: 'GAME_ACTION'; playerId: PlayerId; action: Action; at: number }
  | { type: 'NEXT_HAND'; playerId: PlayerId; at: number }
  /** The heartbeat: drives AI seats and expires claim windows. */
  | { type: 'TICK'; at: number };

export type CommandResult = { room: Room; error?: string; changed: boolean };

/** What one player is allowed to know about the room. */
export type SeatView = {
  seat: SeatId;
  name: string;
  kind: Occupant['kind'];
  connected: boolean;
  isHost: boolean;
  isYou: boolean;
};

export type RoomView = {
  code: string;
  status: RoomStatus;
  version: number;
  hostId: PlayerId;
  ruleset: Ruleset;
  seats: SeatView[];
  /** Null while you are only spectating — every seat was taken when you joined. */
  yourSeat: SeatId | null;
  playerId: PlayerId;
  /** Filtered: your tiles, everyone else's counts. Never the wall. */
  game: PublicGameView | null;
  settlement: Settlement | null;
  claimDeadline: number | null;
  events: RoomEvent[];
};
