/**
 * How the app talks to a room.
 *
 * Two implementations, one interface:
 *   - LocalTransport runs the real room server in this process, so a table of
 *     AI seats needs no network at all — and so the online code path is the
 *     one exercised in solo play too.
 *   - SupabaseTransport talks to an Edge Function running that same module.
 *
 * Whichever it is, the client never holds authority: it sends commands and
 * renders whatever filtered view comes back.
 */

import {
  applyCommand,
  createRoom,
  roomView,
  type PlayerId,
  type Room,
  type RoomCommand,
  type RoomView,
} from '@bahay/room';
import type { Ruleset } from '@bahay/engine';

export type TransportKind = 'local' | 'supabase';

export type ConnectionState = 'connecting' | 'online' | 'offline' | 'error';

export type TransportStatus = {
  connection: ConnectionState;
  /** Set when the last command was refused, so the UI can say why. */
  error: string | null;
};

export interface RoomTransport {
  readonly kind: TransportKind;
  /** Push a command and receive the resulting view. */
  send(command: RoomCommand): Promise<void>;
  /** Called on every new view, including the first. Returns an unsubscribe. */
  subscribe(listener: (view: RoomView, status: TransportStatus) => void): () => void;
  dispose(): void;
}

/** How often a table advances itself: AI beats, claim windows, reconnects. */
export const TICK_INTERVAL_MS = 250;

export class LocalTransport implements RoomTransport {
  readonly kind = 'local';
  private room: Room;
  private readonly playerId: PlayerId;
  private listeners = new Set<(view: RoomView, status: TransportStatus) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: TransportStatus = { connection: 'online', error: null };

  constructor(options: { playerId: PlayerId; name: string; ruleset?: Ruleset; seed?: string }) {
    this.playerId = options.playerId;
    this.room = createRoom({
      hostId: options.playerId,
      hostName: options.name,
      ruleset: options.ruleset,
      seed: options.seed,
      at: Date.now(),
    });
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private tick(): void {
    const before = this.room.version;
    const result = applyCommand(this.room, { type: 'TICK', at: Date.now() });
    this.room = result.room;
    if (this.room.version !== before) this.emit();
  }

  private emit(): void {
    const view = roomView(this.room, this.playerId);
    for (const listener of this.listeners) listener(view, this.status);
  }

  async send(command: RoomCommand): Promise<void> {
    const result = applyCommand(this.room, command);
    this.room = result.room;
    this.status = { connection: 'online', error: result.error ?? null };
    this.emit();
  }

  subscribe(listener: (view: RoomView, status: TransportStatus) => void): () => void {
    this.listeners.add(listener);
    listener(roomView(this.room, this.playerId), this.status);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listeners.clear();
  }
}
