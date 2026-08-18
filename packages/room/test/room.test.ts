import { describe, expect, it } from 'vitest';
import { currentSeat, legalActions, type Action, type SeatId } from '@bahay/engine';
import {
  applyCommand,
  createRoom,
  CLAIM_WINDOW_MS,
  DISCONNECT_GRACE_MS,
  generateRoomCode,
  roomView,
  SEAT_HOLD_MS,
  seatOf,
  waitingSeats,
  type Room,
} from '../src/index.js';

const T0 = 1_700_000_000_000;

function host(at = T0): Room {
  return createRoom({ hostId: 'p-host', hostName: 'Cory', at, seed: 'test-room' });
}

function run(room: Room, ...commands: Parameters<typeof applyCommand>[1][]): Room {
  let current = room;
  for (const command of commands) {
    const result = applyCommand(current, command);
    current = result.room;
  }
  return current;
}

function started(at = T0): Room {
  let room = host(at);
  room = run(
    room,
    { type: 'JOIN', playerId: 'p-tita', name: 'Tita Baby', at },
    { type: 'FILL_SEAT', playerId: 'p-host', seat: 2, difficulty: 'lolo', at },
    { type: 'FILL_SEAT', playerId: 'p-host', seat: 3, difficulty: 'tita', at },
    { type: 'START', playerId: 'p-host', at },
  );
  return room;
}

describe('room codes', () => {
  it('are six characters with nothing ambiguous in them', () => {
    const code = generateRoomCode('abc');
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('are stable for a seed and different across seeds', () => {
    expect(generateRoomCode('abc')).toBe(generateRoomCode('abc'));
    expect(generateRoomCode('abc')).not.toBe(generateRoomCode('abd'));
  });
});

describe('joining and seating', () => {
  it('seats the host at seat 0 and leaves the rest open', () => {
    const room = host();
    expect(room.seats[0]).toMatchObject({ kind: 'human', name: 'Cory' });
    expect(room.seats.slice(1).every((s) => s.kind === 'open')).toBe(true);
    expect(room.status).toBe('lobby');
  });

  it('gives each new player the next open seat', () => {
    const room = run(
      host(),
      { type: 'JOIN', playerId: 'p2', name: 'Ana', at: T0 },
      { type: 'JOIN', playerId: 'p3', name: 'Ben', at: T0 },
    );
    expect(seatOf(room, 'p2')).toBe(1);
    expect(seatOf(room, 'p3')).toBe(2);
  });

  it('refuses a fifth player', () => {
    let room = host();
    for (const id of ['p2', 'p3', 'p4']) {
      room = run(room, { type: 'JOIN', playerId: id, name: id, at: T0 });
    }
    const result = applyCommand(room, { type: 'JOIN', playerId: 'p5', name: 'Late', at: T0 });
    expect(result.error).toBeTruthy();
    expect(result.changed).toBe(false);
  });

  it('lets a player move to a different open seat before the start', () => {
    const room = run(host(), { type: 'SIT', playerId: 'p-host', seat: 2, at: T0 });
    expect(seatOf(room, 'p-host')).toBe(2);
    expect(room.seats[0].kind).toBe('open');
  });

  it('frees the seat when someone leaves the lobby', () => {
    const room = run(
      host(),
      { type: 'JOIN', playerId: 'p2', name: 'Ana', at: T0 },
      { type: 'LEAVE', playerId: 'p2', at: T0 },
    );
    expect(room.seats[1].kind).toBe('open');
  });
});

describe('only the host may reshape the table', () => {
  const guest = { playerId: 'p2', name: 'Ana', at: T0 };

  it('refuses a guest filling a seat with AI', () => {
    const room = run(host(), { type: 'JOIN', ...guest });
    const result = applyCommand(room, {
      type: 'FILL_SEAT',
      playerId: 'p2',
      seat: 3,
      difficulty: 'lolo',
      at: T0,
    });
    expect(result.error).toMatch(/host/);
  });

  it('refuses a guest changing the rules', () => {
    const room = run(host(), { type: 'JOIN', ...guest });
    const result = applyCommand(room, {
      type: 'SET_RULESET',
      playerId: 'p2',
      ruleset: { ...room.ruleset, jokerEnabled: false },
      at: T0,
    });
    expect(result.error).toMatch(/host/);
    expect(result.room.ruleset.jokerEnabled).toBe(true);
  });

  it('refuses a guest starting the hand', () => {
    const room = run(host(), { type: 'JOIN', ...guest });
    expect(applyCommand(room, { type: 'START', playerId: 'p2', at: T0 }).error).toMatch(/host/);
  });

  it("binds everyone to the host's ruleset once the hand starts", () => {
    let room = run(host(), { type: 'JOIN', ...guest });
    room = run(room, {
      type: 'SET_RULESET',
      playerId: 'p-host',
      ruleset: { ...room.ruleset, jokerEnabled: false, chowFromAnyPlayer: true },
      at: T0,
    });
    room = run(room, { type: 'START', playerId: 'p-host', at: T0 });
    expect(room.game!.ruleset.jokerEnabled).toBe(false);
    expect(room.game!.joker).toBeNull();
    expect(roomView(room, 'p2').ruleset.chowFromAnyPlayer).toBe(true);
  });
});

describe('starting a hand', () => {
  it('fills any remaining open seat with the house', () => {
    const room = run(host(), { type: 'START', playerId: 'p-host', at: T0 });
    expect(room.status).toBe('playing');
    expect(room.seats.filter((s) => s.kind === 'ai')).toHaveLength(3);
    expect(room.game).not.toBeNull();
  });

  it('deals a real hand', () => {
    const room = started();
    expect(room.game!.players[0].concealed).toHaveLength(17);
    expect(room.game!.players[1].concealed).toHaveLength(16);
  });
});

describe('nobody may act for a seat they do not hold', () => {
  it('refuses an action carrying another seat', () => {
    const room = started();
    const result = applyCommand(room, {
      type: 'GAME_ACTION',
      playerId: 'p-tita',
      action: { type: 'DISCARD', seat: 0, tileId: room.game!.players[0].concealed[0].id },
      at: T0,
    });
    expect(result.error).toMatch(/not your seat/);
    expect(result.room.game!.discards).toHaveLength(0);
  });

  it('refuses an action from someone with no seat at all', () => {
    const room = started();
    const result = applyCommand(room, {
      type: 'GAME_ACTION',
      playerId: 'stranger',
      action: { type: 'DISCARD', seat: 0, tileId: room.game!.players[0].concealed[0].id },
      at: T0,
    });
    expect(result.error).toMatch(/not seated/);
  });

  it('refuses an action the engine says is illegal', () => {
    const room = started();
    const result = applyCommand(room, {
      type: 'GAME_ACTION',
      playerId: 'p-host',
      action: { type: 'DRAW', seat: 0 }, // the máno discards first, never draws
      at: T0,
    });
    expect(result.error).toMatch(/illegal/);
  });

  it('accepts a legal action from the seat that owns it', () => {
    const room = started();
    const tileId = room.game!.players[0].concealed[0].id;
    const result = applyCommand(room, {
      type: 'GAME_ACTION',
      playerId: 'p-host',
      action: { type: 'DISCARD', seat: 0, tileId },
      at: T0,
    });
    expect(result.error).toBeUndefined();
    expect(result.room.game!.discards[0].tile.id).toBe(tileId);
  });
});

describe('the view a client receives', () => {
  it('never contains another player’s tiles or the wall', () => {
    const room = started();
    const view = roomView(room, 'p-tita');
    expect(view.yourSeat).toBe(1);
    expect(view.game!.hand).toHaveLength(16);

    const serialized = JSON.stringify(view);
    for (const tile of room.game!.players[0].concealed) {
      expect(serialized).not.toContain(tile.id);
    }
    for (const tile of room.game!.players[2].concealed) {
      expect(serialized).not.toContain(tile.id);
    }
    expect((view.game as Record<string, unknown>).wall).toBeUndefined();
  });

  it('shows a spectator the table but no hand', () => {
    let room = started();
    room = run(room, { type: 'JOIN', playerId: 'watcher', name: 'Watcher', at: T0 });
    const view = roomView(room, 'watcher');
    expect(view.yourSeat).toBeNull();
    expect(view.game!.hand).toEqual([]);
  });

  it('names the seats and marks who you are', () => {
    const view = roomView(started(), 'p-tita');
    expect(view.seats[0]).toMatchObject({ name: 'Cory', isHost: true, isYou: false });
    expect(view.seats[1]).toMatchObject({ name: 'Tita Baby', isYou: true });
    expect(view.seats[2]).toMatchObject({ kind: 'ai', name: 'Lolo' });
  });
});

describe('the heartbeat drives the table', () => {
  it('plays the AI seats when their beat comes due', () => {
    let room = started();
    const tileId = room.game!.players[0].concealed[0].id;
    room = run(room, {
      type: 'GAME_ACTION',
      playerId: 'p-host',
      action: { type: 'DISCARD', seat: 0, tileId },
      at: T0,
    });
    const before = room.game!.history.length;
    room = run(room, { type: 'TICK', at: T0 + 60_000 });
    // The AI seats answered the discard and the hand moved on, all without a
    // second action from either human.
    expect(room.game!.history.length).toBeGreaterThan(before);
    const humanDiscards = room.game!.history.filter(
      (a) => a.type === 'DISCARD' && (a.seat === 0 || a.seat === 1),
    );
    expect(humanDiscards).toHaveLength(1); // only the one we dispatched
  });

  it('catches up in bounded steps rather than blocking on a long gap', () => {
    let room = started();
    room = run(room, {
      type: 'GAME_ACTION',
      playerId: 'p-host',
      action: { type: 'DISCARD', seat: 0, tileId: room.game!.players[0].concealed[0].id },
      at: T0,
    });
    // A server that was asleep for an hour still lands somewhere coherent.
    let now = T0 + 60 * 60_000;
    for (let i = 0; i < 20; i++) {
      room = run(room, { type: 'TICK', at: now });
      now += 1_000;
    }
    const waiting = waitingSeats(room);
    const humanSeats: SeatId[] = [0, 1];
    expect(waiting.length === 0 || waiting.some((seat) => humanSeats.includes(seat))).toBe(true);
  });

  it('passes for a human whose claim window expires, and nothing else', () => {
    let room = started();
    // Walk the hand until a claim window is open on a human seat.
    let guard = 0;
    while (guard++ < 200) {
      const claimants = waitingSeats(room).filter((seat) => seat === 0 || seat === 1);
      if (
        room.game!.phase.name === 'PENDING_CLAIMS' &&
        claimants.length > 0 &&
        room.claimDeadline !== null
      ) {
        break;
      }
      const seat = currentSeat(room.game!);
      if (seat === 0 || seat === 1) {
        const options = legalActions(room.game!, seat);
        const draw = options.find((a) => a.type === 'DRAW');
        const discard = options.find((a) => a.type === 'DISCARD');
        const action = (draw ?? discard) as Action;
        room = run(room, {
          type: 'GAME_ACTION',
          playerId: seat === 0 ? 'p-host' : 'p-tita',
          action,
          at: T0,
        });
      } else {
        room = run(room, { type: 'TICK', at: T0 + guard * 5_000 });
      }
      if (room.game!.phase.name === 'HAND_OVER') break;
    }

    if (room.game!.phase.name !== 'PENDING_CLAIMS') return; // no window arose; nothing to assert
    const humansWaiting: SeatId[] = waitingSeats(room).filter((seat) => seat === 0 || seat === 1);
    const deadline = room.claimDeadline!;
    const humanPasses = (r: Room) =>
      r.game!.history.filter((a) => a.type === 'PASS' && humansWaiting.includes(a.seat)).length;
    const before = humanPasses(room);

    // Up to the deadline the human's seat is left alone. (An AI sharing the
    // same window may well answer sooner — that is its own beat, not theirs.)
    room = run(room, { type: 'TICK', at: deadline - 1 });
    expect(humanPasses(room)).toBe(before);

    // Once it expires the server passes for them, and only passes.
    room = run(room, { type: 'TICK', at: deadline + 1 });
    expect(humanPasses(room)).toBeGreaterThan(before);
  });

  it('never discards for a human who is still at the table', () => {
    let room = started();
    // Seat 0 is the máno and must discard. No amount of ticking may do it,
    // for as long as their client keeps checking in.
    expect(room.game!.phase).toMatchObject({ name: 'AWAITING_DISCARD', seat: 0 });
    for (let at = T0; at < T0 + 10 * 60_000; at += 1_000) {
      room = run(room, { type: 'TICK', at, playerId: 'p-host' });
    }
    expect(room.game!.phase).toMatchObject({ name: 'AWAITING_DISCARD', seat: 0 });
    expect(room.game!.discards).toHaveLength(0);
  });

  it('plays for a human whose client has stopped checking in', () => {
    let room = started();
    expect(room.game!.phase).toMatchObject({ name: 'AWAITING_DISCARD', seat: 0 });
    // No heartbeat from seat 0 — a closed app, a dead battery, a lost signal
    // with no chance to say goodbye. The table must not sit there forever.
    room = run(room, { type: 'TICK', at: T0 + 60_000 });
    expect(room.game!.discards.length).toBeGreaterThan(0);
  });
});

describe('someone loses signal', () => {
  it('holds the seat and lets the house cover after the grace period', () => {
    let room = started();
    room = run(room, { type: 'LEAVE', playerId: 'p-tita', at: T0 });
    expect(room.seats[1]).toMatchObject({ kind: 'human', connected: false });

    const tileId = room.game!.players[0].concealed[0].id;
    room = run(room, {
      type: 'GAME_ACTION',
      playerId: 'p-host',
      action: { type: 'DISCARD', seat: 0, tileId },
      at: T0,
    });
    // Past the grace period, the table plays on rather than stalling.
    room = run(room, { type: 'TICK', at: T0 + DISCONNECT_GRACE_MS + 60_000 });
    expect(room.game!.history.length).toBeGreaterThan(1);
    expect(seatOf(room, 'p-tita')).toBe(1);
  });

  it('gives the seat back on reconnect, hand intact', () => {
    let room = started();
    const handBefore = room.game!.players[1].concealed.map((t) => t.id);
    room = run(room, { type: 'LEAVE', playerId: 'p-tita', at: T0 });
    room = run(room, { type: 'JOIN', playerId: 'p-tita', name: 'Tita Baby', at: T0 + 5_000 });
    expect(room.seats[1]).toMatchObject({ kind: 'human', connected: true });
    expect(roomView(room, 'p-tita').game!.hand.map((t) => t.id)).toEqual(handBefore);
    expect(room.events.some((e) => e.type === 'RECONNECTED')).toBe(true);
  });

  it('keeps the seat reserved until the hold expires', () => {
    let room = started();
    room = run(room, { type: 'LEAVE', playerId: 'p-tita', at: T0 });
    const tooSoon = applyCommand(room, {
      type: 'JOIN',
      playerId: 'someone-else',
      name: 'Nosy',
      at: T0 + SEAT_HOLD_MS - 1,
    });
    expect(tooSoon.error).toBeTruthy();

    const later = applyCommand(room, {
      type: 'JOIN',
      playerId: 'someone-else',
      name: 'Nosy',
      at: T0 + SEAT_HOLD_MS + 1,
    });
    expect(later.error).toBeUndefined();
    expect(seatOf(later.room, 'someone-else')).toBe(1);
  });
});

describe('a whole hand plays out through commands', () => {
  it('reaches a settlement with two humans and two AI seats', () => {
    let room = started();
    let now = T0;
    let guard = 0;

    while (room.game!.phase.name !== 'HAND_OVER' && guard++ < 600) {
      now += 1_000;
      const waiting = waitingSeats(room);
      const humanSeat = waiting.find((seat) => seat === 0 || seat === 1);

      if (humanSeat !== undefined) {
        const options = legalActions(room.game!, humanSeat);
        const todas = options.find((a) => a.type === 'DECLARE_TODAS' || (a.type === 'CLAIM' && a.call === 'todas'));
        const draw = options.find((a) => a.type === 'DRAW');
        const pass = options.find((a) => a.type === 'PASS');
        const discard = options.find((a) => a.type === 'DISCARD');
        const action = (todas ?? draw ?? pass ?? discard) as Action | undefined;
        if (action) {
          room = run(room, {
            type: 'GAME_ACTION',
            playerId: humanSeat === 0 ? 'p-host' : 'p-tita',
            action,
            at: now,
          });
          continue;
        }
      }
      room = run(room, { type: 'TICK', at: now + CLAIM_WINDOW_MS + 5_000 });
    }

    expect(room.game!.phase.name).toBe('HAND_OVER');
    expect(room.events.some((e) => e.type === 'HAND_OVER')).toBe(true);
    // The table stays zero-sum across four seats.
    const chips = room.game!.players.reduce((n, p) => n + p.chips, 0);
    expect(Math.abs(chips)).toBeLessThan(1e-9);
  });

  it('deals the next hand only for the host', () => {
    let room = started();
    let now = T0;
    let guard = 0;
    while (room.game!.phase.name !== 'HAND_OVER' && guard++ < 600) {
      now += 1_000;
      const waiting = waitingSeats(room);
      const humanSeat = waiting.find((seat) => seat === 0 || seat === 1);
      if (humanSeat !== undefined) {
        const options = legalActions(room.game!, humanSeat);
        const action = (options.find((a) => a.type === 'DECLARE_TODAS') ??
          options.find((a) => a.type === 'DRAW') ??
          options.find((a) => a.type === 'PASS') ??
          options.find((a) => a.type === 'DISCARD')) as Action | undefined;
        if (action) {
          room = run(room, {
            type: 'GAME_ACTION',
            playerId: humanSeat === 0 ? 'p-host' : 'p-tita',
            action,
            at: now,
          });
          continue;
        }
      }
      room = run(room, { type: 'TICK', at: now + CLAIM_WINDOW_MS + 5_000 });
    }

    expect(applyCommand(room, { type: 'NEXT_HAND', playerId: 'p-tita', at: now }).error).toMatch(
      /host/,
    );
    const dealt = applyCommand(room, { type: 'NEXT_HAND', playerId: 'p-host', at: now });
    expect(dealt.error).toBeUndefined();
    expect(dealt.room.game!.handNumber).toBe(2);
  });
});

describe('versioning', () => {
  it('bumps on every accepted command and not on a rejected one', () => {
    const room = host();
    const joined = applyCommand(room, { type: 'JOIN', playerId: 'p2', name: 'Ana', at: T0 });
    expect(joined.room.version).toBe(room.version + 1);

    const rejected = applyCommand(joined.room, {
      type: 'START',
      playerId: 'p2',
      at: T0,
    });
    expect(rejected.room.version).toBe(joined.room.version);
  });
});
