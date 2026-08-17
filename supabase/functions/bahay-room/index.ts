/**
 * Báhay room server — the Supabase adapter.
 *
 * All of the thinking lives in packages/room (bundled into ./_room.js): this
 * file only teaches it how to read and write a row, so the edge and the local
 * dev server run identical logic.
 *
 * The row holds every player's tiles and the wall order and is protected by
 * RLS with no policies — the service role used here is the only way in, and
 * each player is answered with their own filtered view.
 */

// @ts-expect-error — resolved by Deno at deploy time.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleRoomRequest, ROOM_TTL_MS } from './_room.js';

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const TABLE = 'bahay_rooms';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const store = {
  async load(code: string) {
    const { data, error } = await db
      .from(TABLE)
      .select('state, version')
      .eq('code', code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { room: data.state, version: data.version } : null;
  },

  /** Optimistic concurrency: four phones polling one table will collide. */
  async save(room: { code: string; version: number }, expectedVersion: number) {
    const { data, error } = await db
      .from(TABLE)
      .update({ state: room, version: room.version, updated_at: new Date().toISOString() })
      .eq('code', room.code)
      .eq('version', expectedVersion)
      .select('code');
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  },

  async insert(room: { code: string; version: number }) {
    const { error } = await db
      .from(TABLE)
      .insert({ code: room.code, state: room, version: room.version });
    return !error;
  },

  async sweep(olderThan: number) {
    await db.from(TABLE).delete().lt('updated_at', new Date(olderThan).toISOString());
  },
};

void ROOM_TTL_MS;

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  if (request.method !== 'POST') return respond(405, { ok: false, error: 'POST only' });

  try {
    const body = await request.json();
    const result = await handleRoomRequest(store, body);
    return respond(result.status, result.body);
  } catch (error) {
    return respond(500, { ok: false, error: String((error as Error)?.message ?? error) });
  }
});
