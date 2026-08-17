/**
 * Prove the bundled server artifact behaves. This is the exact file the Edge
 * Function imports, so a hand played here is a hand played on the server.
 */
import {
  applyCommand,
  createRoom,
  roomView,
} from '../supabase/functions/bahay-room/_room.js';

const T0 = Date.now();
let room = createRoom({ hostId: 'host', hostName: 'Cory', at: T0, seed: 'bundle-check' });

for (const command of [
  { type: 'JOIN', playerId: 'guest', name: 'Ana', at: T0 },
  { type: 'START', playerId: 'host', at: T0 },
]) {
  room = applyCommand(room, command).room;
}

if (room.status !== 'playing') throw new Error('room did not start');
if (room.game.players[0].concealed.length !== 17) throw new Error('bad deal');

// The two security properties, checked against the shipped artifact.
const guestView = roomView(room, 'guest');
const serialized = JSON.stringify(guestView);
for (const tile of room.game.players[0].concealed) {
  if (serialized.includes(tile.id)) throw new Error('leaked the host hand');
}
if (serialized.includes('"wall"')) throw new Error('leaked the wall');

const stolen = applyCommand(room, {
  type: 'GAME_ACTION',
  playerId: 'guest',
  action: { type: 'DISCARD', seat: 0, tileId: room.game.players[0].concealed[0].id },
  at: T0,
});
if (!stolen.error) throw new Error('a player acted for a seat they do not hold');

// Play the hand out: humans take the simplest legal action, the tick drives
// the rest.
let now = T0;
let guard = 0;
while (room.game.phase.name !== 'HAND_OVER' && guard++ < 1200) {
  now += 1000;
  const before = room.game.history.length;
  room = applyCommand(room, { type: 'TICK', at: now + 10_000 }).room;
  if (room.game.phase.name === 'HAND_OVER') break;

  for (const [seat, playerId] of [
    [0, 'host'],
    [1, 'guest'],
  ]) {
    const options = room.game.phase.name === 'HAND_OVER' ? [] : legalFor(room, seat);
    const action =
      options.find((a) => a.type === 'DECLARE_TODAS') ??
      options.find((a) => a.type === 'CLAIM' && a.call === 'todas') ??
      options.find((a) => a.type === 'DRAW') ??
      options.find((a) => a.type === 'PASS') ??
      options.find((a) => a.type === 'DISCARD');
    if (action) {
      room = applyCommand(room, { type: 'GAME_ACTION', playerId, action, at: now }).room;
    }
  }
  if (room.game.history.length === before) now += 10_000;
}

if (room.game.phase.name !== 'HAND_OVER') throw new Error('hand never finished');

const chips = room.game.players.reduce((n, p) => n + p.chips, 0);
if (Math.abs(chips) > 1e-9) throw new Error(`table is not zero-sum: ${chips}`);

const settlement = room.game.phase.settlement;
console.log(
  `bundle ok — hand settled as ${settlement.winType}` +
    (settlement.winner === null ? '' : ` for seat ${settlement.winner}`) +
    `, ${room.game.history.length} actions, table zero-sum`,
);

function legalFor(room, seat) {
  // legalActions is not re-exported by the bundle's public surface; the room
  // module's own guard rejects anything illegal, so probe the obvious moves.
  const phase = room.game.phase;
  const player = room.game.players[seat];
  if (phase.name === 'AWAITING_DRAW' && phase.seat === seat) return [{ type: 'DRAW', seat }];
  if (phase.name === 'AWAITING_DISCARD' && phase.seat === seat) {
    return [{ type: 'DISCARD', seat, tileId: player.concealed[0].id }];
  }
  if (phase.name === 'PENDING_CLAIMS') {
    const responded =
      phase.passed.includes(seat) || phase.claims.some((c) => c.seat === seat);
    if (phase.eligible.includes(seat) && !responded) return [{ type: 'PASS', seat }];
  }
  return [];
}
