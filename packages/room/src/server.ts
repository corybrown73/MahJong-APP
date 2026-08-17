/**
 * The room server, minus the platform.
 *
 * Everything a host has to get right — ticking the table, applying a command,
 * retrying a lost write, answering with a filtered view — lives here. A
 * Supabase Edge Function and a plain Node process differ only in how they
 * store rooms, so both wrap this with a RoomStore and neither can drift.
 */

import { applyCommand, createRoom, generateRoomCode, roomView } from './room.js';
import type { Room, RoomCommand, RoomView } from './types.js';

/** Rooms nobody has touched in a day are gone. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_WRITE_ATTEMPTS = 4;
const MAX_CODE_ATTEMPTS = 5;

export type StoredRoom = { room: Room; version: number };

export interface RoomStore {
  load(code: string): Promise<StoredRoom | null>;
  /** Must only succeed if the stored version still matches `expectedVersion`. */
  save(room: Room, expectedVersion: number): Promise<boolean>;
  insert(room: Room): Promise<boolean>;
  sweep(olderThan: number): Promise<void>;
}

export type RoomRequest = {
  create?: boolean;
  code?: string;
  playerId?: string;
  name?: string;
  ruleset?: unknown;
  command?: Partial<RoomCommand> | null;
};

export type RoomResponse = {
  status: number;
  body:
    | { ok: true; code?: string; view: RoomView; error?: string }
    | { ok: false; error: string; view?: RoomView };
};

function reply(status: number, body: RoomResponse['body']): RoomResponse {
  return { status, body };
}

export async function handleRoomRequest(
  store: RoomStore,
  request: RoomRequest,
  now: () => number = Date.now,
): Promise<RoomResponse> {
  const playerId = (request.playerId ?? '').trim();
  const name = (request.name ?? 'Player').trim().slice(0, 16) || 'Player';
  if (!playerId) return reply(400, { ok: false, error: 'missing player' });

  if (request.create) {
    await store.sweep(now() - ROOM_TTL_MS);
    // Codes are short so they can be read aloud, which means collisions are
    // possible; try a few before giving up.
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const at = now();
      const code = generateRoomCode(`${at}-${playerId}-${attempt}`);
      if (await store.load(code)) continue;
      const room = createRoom({
        code,
        hostId: playerId,
        hostName: name,
        ruleset: (request.ruleset as Room['ruleset']) ?? undefined,
        seed: `${code}-${at}`,
        at,
      });
      if (!(await store.insert(room))) continue;
      return reply(200, { ok: true, code, view: roomView(room, playerId) });
    }
    return reply(503, { ok: false, error: 'could not open a table' });
  }

  const code = (request.code ?? '').trim().toUpperCase();
  if (!code) return reply(400, { ok: false, error: 'missing room code' });

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    const stored = await store.load(code);
    if (!stored) return reply(404, { ok: false, error: 'no table with that code' });

    const at = now();
    // Every request advances the table before it is answered, so whichever
    // client is awake keeps the AI seats moving. No cron, no idle server.
    const ticked = applyCommand(stored.room, { type: 'TICK', at });
    let room = ticked.room;
    let changed = ticked.changed;
    let error: string | undefined;

    if (request.command) {
      const command = { ...request.command, playerId, at } as RoomCommand;
      const result = applyCommand(room, command);
      room = result.room;
      error = result.error;
      changed = changed || result.changed;
    }

    if (!changed) {
      return reply(200, { ok: true, view: roomView(room, playerId), error });
    }

    if (await store.save(room, stored.version)) {
      const view = roomView(room, playerId);
      return error ? reply(200, { ok: false, error, view }) : reply(200, { ok: true, view });
    }
    // Somebody else wrote first. Read again and replay rather than clobber.
  }

  return reply(409, { ok: false, error: 'the table is busy, try again' });
}

/** An in-memory store — the Node dev server, and the tests, use this. */
export function createMemoryStore(): RoomStore & { rooms: Map<string, StoredRoom> } {
  const rooms = new Map<string, StoredRoom>();
  return {
    rooms,
    async load(code) {
      const stored = rooms.get(code);
      return stored ? { room: stored.room, version: stored.version } : null;
    },
    async save(room, expectedVersion) {
      const stored = rooms.get(room.code);
      if (!stored || stored.version !== expectedVersion) return false;
      rooms.set(room.code, { room, version: room.version });
      return true;
    },
    async insert(room) {
      if (rooms.has(room.code)) return false;
      rooms.set(room.code, { room, version: room.version });
      return true;
    },
    async sweep(olderThan) {
      for (const [code, stored] of rooms) {
        if (stored.room.updatedAt < olderThan) rooms.delete(code);
      }
    },
  };
}
