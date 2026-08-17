/**
 * A Báhay room server you can run on your laptop.
 *
 *   pnpm room:dev            # listens on 8787
 *
 * It runs the exact bundle the Edge Function runs and the exact request
 * handler, over an in-memory store instead of Postgres — so a table played
 * against this is a table played against the real server, minus the database.
 * Useful for testing four seats on one machine, and for playing over a home
 * network without deploying anything.
 */
import { createServer } from 'node:http';
import { createMemoryStore, handleRoomRequest } from '../supabase/functions/bahay-room/_room.js';

const port = Number(process.env.PORT ?? 8787);
const store = createMemoryStore();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(200, CORS).end('ok');
    return;
  }
  if (request.method !== 'POST') {
    response.writeHead(405, { ...CORS, 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error: 'POST only' }));
    return;
  }

  let raw = '';
  for await (const chunk of request) raw += chunk;

  try {
    const result = await handleRoomRequest(store, JSON.parse(raw || '{}'));
    response.writeHead(result.status, { ...CORS, 'Content-Type': 'application/json' });
    response.end(JSON.stringify(result.body));
  } catch (error) {
    response.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
  }
}).listen(port, () => {
  console.log(`Báhay room server on http://localhost:${port}`);
  console.log('Point the app at it with:');
  console.log(`  EXPO_PUBLIC_ROOM_URL=http://localhost:${port}`);
});
