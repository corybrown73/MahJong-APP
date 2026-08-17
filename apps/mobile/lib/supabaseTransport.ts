/**
 * Online rooms, over a Supabase Edge Function.
 *
 * The function is the authority: it holds the Room (including everyone's
 * concealed tiles), applies commands, and answers each client with only that
 * client's filtered view. The row itself is never readable by a client — that
 * is enforced by row-level security, not by good manners.
 *
 * Every request also carries a tick, so whichever client is awake keeps the
 * table moving. No cron, no idle room server.
 */

import type { RoomCommand, RoomView } from '@bahay/room';
import type { RoomTransport, TransportStatus } from './transport';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
/**
 * A room server reached directly, bypassing Supabase — `pnpm room:dev` on a
 * laptop, or any host running the same handler. Handy for testing four seats
 * on one network before anything is deployed.
 */
export const ROOM_URL = process.env.EXPO_PUBLIC_ROOM_URL ?? '';

export function roomEndpoint(): string {
  if (ROOM_URL) return ROOM_URL.replace(/\/$/, '');
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/bahay-room`;
}

function authHeaders(): Record<string, string> {
  if (ROOM_URL) return { 'Content-Type': 'application/json' };
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

export function onlinePlayAvailable(): boolean {
  return ROOM_URL.length > 0 || (SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0);
}

/** How often to ask the server for a fresh view while a hand is running. */
const POLL_MS = 1_200;
/** Backoff ceiling when the network is unhappy. */
const MAX_BACKOFF_MS = 8_000;

type Envelope =
  | { ok: true; view: RoomView }
  | { ok: false; error: string };

export class SupabaseTransport implements RoomTransport {
  readonly kind = 'supabase';
  private listeners = new Set<(view: RoomView, status: TransportStatus) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private view: RoomView | null = null;
  private status: TransportStatus = { connection: 'connecting', error: null };
  private backoff = POLL_MS;

  constructor(
    private readonly options: { code: string; playerId: string; name: string },
  ) {
    void this.poll();
  }

  private async post(body: unknown): Promise<Envelope> {
    const response = await fetch(roomEndpoint(), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return { ok: false, error: `server said ${response.status}` };
    }
    return (await response.json()) as Envelope;
  }

  private emit(): void {
    if (!this.view) return;
    for (const listener of this.listeners) listener(this.view, this.status);
  }

  private schedule(delay: number): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.poll(), delay);
  }

  /** Ask for the current view. The server ticks the table as it answers. */
  private async poll(): Promise<void> {
    if (this.disposed) return;
    try {
      const envelope = await this.post({
        code: this.options.code,
        playerId: this.options.playerId,
        name: this.options.name,
        command: null,
      });
      if (envelope.ok) {
        this.view = envelope.view;
        this.status = { connection: 'online', error: null };
        this.backoff = POLL_MS;
      } else {
        this.status = { connection: 'error', error: envelope.error };
        this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
      }
    } catch {
      // A dropped connection is expected on a phone; keep the last view on
      // screen, say so, and keep trying.
      this.status = { connection: 'offline', error: null };
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    }
    this.emit();
    this.schedule(this.backoff);
  }

  async send(command: RoomCommand): Promise<void> {
    try {
      const envelope = await this.post({
        code: this.options.code,
        playerId: this.options.playerId,
        name: this.options.name,
        command,
      });
      if (envelope.ok) {
        this.view = envelope.view;
        this.status = { connection: 'online', error: null };
      } else {
        this.status = { connection: 'online', error: envelope.error };
      }
    } catch {
      this.status = { connection: 'offline', error: null };
    }
    this.emit();
    // Something just changed; look again promptly rather than on the slow beat.
    this.schedule(300);
  }

  subscribe(listener: (view: RoomView, status: TransportStatus) => void): () => void {
    this.listeners.add(listener);
    if (this.view) listener(this.view, this.status);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }
}

/** Create a room on the server and return its code. */
export async function createOnlineRoom(options: {
  playerId: string;
  name: string;
  ruleset: unknown;
}): Promise<{ code: string } | { error: string }> {
  try {
    const response = await fetch(roomEndpoint(), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ create: true, ...options }),
    });
    if (!response.ok) return { error: `server said ${response.status}` };
    const payload = (await response.json()) as { ok: boolean; code?: string; error?: string };
    if (!payload.ok || !payload.code) return { error: payload.error ?? 'could not open the room' };
    return { code: payload.code };
  } catch {
    return { error: 'could not reach the table' };
  }
}
