/**
 * Báhay room server.
 *
 * The authority for online play. Clients send commands; this function runs the
 * same rules engine the app runs, persists the result, and answers each player
 * with only what that player may see. Concealed hands and the wall order never
 * leave this process.
 *
 * There is no idle room server and no cron: every request also ticks the
 * table, so whichever client is awake keeps the AI seats moving and expires
 * claim windows on time.
 */

// @ts-expect-error — resolved by Deno at deploy time.
import { createClient } from 'jsr:@supabase/supabase-js@2';
// The bundled rules. Regenerate with `pnpm bundle:room`.
import {
  applyCommand,
  createRoom,
  generateRoomCode,
  roomView,
} from './_room.js';

declare const Deno: { env: { get(key: string): string | undefined } };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TABLE = 'bahay_rooms';

/** Rooms nobody has touched in a day are gone. */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_WRITE_ATTEMPTS = 4;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Body = {
  create?: boolean;
  code?: string;
  playerId?: string;
  name?: string;
  ruleset?: unknown;
  command?: Record<string, unknown> | null;
};

async function loadRoom(code: string) {
  const { data, error } = await db
    .from(TABLE)
    .select('code, state, version')
    .eq('code', code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { code: string; state: Record<string, unknown>; version: number } | null;
}

/**
 * Save with optimistic concurrency: four phones polling the same table will
 * collide, and the loser re-reads and replays rather than clobbering.
 */
async function saveRoom(room: Record<string, unknown>, expectedVersion: number): Promise<boolean> {
  const { data, error } = await db
    .from(TABLE)
    .update({
      state: room,
      version: room.version as number,
      updated_at: new Date().toISOString(),
    })
    .eq('code', room.code as string)
    .eq('version', expectedVersion)
    .select('code');
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

async function sweepOldRooms(): Promise<void> {
  const cutoff = new Date(Date.now() - ROOM_TTL_MS).toISOString();
  await db.from(TABLE).delete().lt('updated_at', cutoff);
}

// @ts-expect-error — Deno global.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, error: 'bad request' }, 400);
  }

  const playerId = (body.playerId ?? '').trim();
  const name = (body.name ?? 'Player').trim().slice(0, 16) || 'Player';
  if (!playerId) return json({ ok: false, error: 'missing player' }, 400);

  try {
    if (body.create) {
      await sweepOldRooms();
      // Codes are short so they can be read aloud, so collisions are possible;
      // try a few before giving up.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRoomCode(`${Date.now()}-${playerId}-${attempt}`);
        const existing = await loadRoom(code);
        if (existing) continue;
        const room = createRoom({
          code,
          hostId: playerId,
          hostName: name,
          ruleset: body.ruleset ?? undefined,
          seed: `${code}-${Date.now()}`,
          at: Date.now(),
        });
        const { error } = await db
          .from(TABLE)
          .insert({ code, state: room, version: room.version });
        if (error) continue;
        return json({ ok: true, code, view: roomView(room, playerId) });
      }
      return json({ ok: false, error: 'could not open a table' }, 503);
    }

    const code = (body.code ?? '').trim().toUpperCase();
    if (!code) return json({ ok: false, error: 'missing room code' }, 400);

    let lastError: string | undefined;
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const row = await loadRoom(code);
      if (!row) return json({ ok: false, error: 'no table with that code' }, 404);

      let room = row.state;
      const at = Date.now();

      // Every request advances the table before it is answered.
      const ticked = applyCommand(room, { type: 'TICK', at });
      room = ticked.room;
      let changed = ticked.changed;
      lastError = undefined;

      if (body.command) {
        const command = { ...body.command, playerId, at };
        const result = applyCommand(room, command);
        room = result.room;
        lastError = result.error;
        changed = changed || result.changed;
      }

      if (!changed) {
        return json({ ok: true, view: roomView(room, playerId), error: lastError });
      }

      const saved = await saveRoom(room, row.version);
      if (saved) {
        return lastError
          ? json({ ok: false, error: lastError, view: roomView(room, playerId) })
          : json({ ok: true, view: roomView(room, playerId) });
      }
      // Someone else wrote first; read again and reapply.
    }

    return json({ ok: false, error: 'the table is busy, try again' }, 409);
  } catch (error) {
    return json({ ok: false, error: String((error as Error).message ?? error) }, 500);
  }
});
