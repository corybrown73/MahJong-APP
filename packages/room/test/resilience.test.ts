import { describe, expect, it } from 'vitest';
import { applyCommand, createRoom, roomView, seatOf, type Room } from '../src/index.js';

const T0 = 1_700_000_000_000;

function run(room: Room, ...commands: Parameters<typeof applyCommand>[1][]): Room {
  let current = room;
  for (const command of commands) current = applyCommand(current, command).room;
  return current;
}

function lobby(at = T0): Room {
  let room = createRoom({ hostId: 'p-host', hostName: 'Cory', at, seed: 'probe-room' });
  room = run(
    room,
    { type: 'JOIN', playerId: 'p-two', name: 'Ana', at },
    { type: 'JOIN', playerId: 'p-three', name: 'Ben', at },
  );
  return room;
}

describe('the room survives the host walking away', () => {
  it('hands the host over when the host leaves the lobby', () => {
    let room = lobby();
    room = run(room, { type: 'LEAVE', playerId: 'p-host', at: T0 + 1000 });
    // Someone still at the table must be able to start the hand.
    const result = applyCommand(room, { type: 'START', playerId: room.hostId, at: T0 + 2000 });
    expect(result.error).toBeUndefined();
    expect(result.room.status).toBe('playing');
    // And the host must be someone actually sitting there.
    expect(seatOf(result.room, result.room.hostId)).not.toBeNull();
  });

  it('hands the host over when the host drops mid-hand', () => {
    let room = lobby();
    room = run(
      room,
      { type: 'FILL_SEAT', playerId: 'p-host', seat: 3, difficulty: 'lolo', at: T0 },
      { type: 'START', playerId: 'p-host', at: T0 },
      { type: 'LEAVE', playerId: 'p-host', at: T0 + 1000 },
    );
    // Long enough that the house has taken the seat over for good.
    let at = T0 + 1000;
    for (let i = 0; i < 400 && room.game?.phase.name !== 'HAND_OVER'; i++) {
      at += 5_000;
      room = applyCommand(room, { type: 'TICK', at }).room;
    }
    expect(room.game?.phase.name).toBe('HAND_OVER');
    // The remaining players must be able to deal the next hand.
    const result = applyCommand(room, { type: 'NEXT_HAND', playerId: room.hostId, at: at + 1000 });
    expect(result.error).toBeUndefined();
    expect(result.room.game?.phase.name).not.toBe('HAND_OVER');
  });
});

describe('an online table plays itself out', () => {
  it('reaches a settlement with only ticks', () => {
    let room = createRoom({ hostId: 'p-host', hostName: 'Cory', at: T0, seed: 'solo-online' });
    room = run(
      room,
      { type: 'FILL_SEAT', playerId: 'p-host', seat: 1, difficulty: 'lolo', at: T0 },
      { type: 'FILL_SEAT', playerId: 'p-host', seat: 2, difficulty: 'tita', at: T0 },
      { type: 'FILL_SEAT', playerId: 'p-host', seat: 3, difficulty: 'kapitbahay', at: T0 },
      { type: 'START', playerId: 'p-host', at: T0 },
      { type: 'LEAVE', playerId: 'p-host', at: T0 },
    );
    let at = T0;
    for (let i = 0; i < 400 && room.game?.phase.name !== 'HAND_OVER'; i++) {
      at += 10_000;
      room = applyCommand(room, { type: 'TICK', at }).room;
    }
    expect(room.game?.phase.name).toBe('HAND_OVER');
    const total = room.game!.players.reduce((n, p) => n + p.chips, 0);
    expect(Math.abs(total)).toBeLessThan(1e-9);
  });
});

describe('a spectator sees nothing they should not', () => {
  it('gives a watcher no tiles and no seat', () => {
    let room = lobby();
    room = run(
      room,
      { type: 'FILL_SEAT', playerId: 'p-host', seat: 3, difficulty: 'lolo', at: T0 },
      { type: 'START', playerId: 'p-host', at: T0 },
    );
    const view = roomView(room, 'p-watcher');
    expect(view.yourSeat).toBeNull();
    expect(view.game?.hand).toEqual([]);
  });
});

describe('a watcher never learns seat 0’s tiles', () => {
  it('hides the tile seat 0 just drew', () => {
    let room = lobby();
    room = run(
      room,
      { type: 'FILL_SEAT', playerId: 'p-host', seat: 3, difficulty: 'lolo', at: T0 },
      { type: 'START', playerId: 'p-host', at: T0 },
    );
    const view = roomView(room, 'p-watcher');
    expect(view.yourSeat).toBeNull();
    const serialised = JSON.stringify(view);
    for (const tile of room.game!.players[0].concealed) {
      expect(serialised).not.toContain(tile.id);
    }
  });
});

describe('the house seats are tellable apart', () => {
  it('gives every seat the host leaves open a different neighbour', () => {
    let room = createRoom({ hostId: 'p-host', hostName: 'Cory', at: T0, seed: 'names' });
    room = run(room, { type: 'START', playerId: 'p-host', at: T0 });
    const names = room.seats.map((occupant) =>
      occupant.kind === 'ai' ? occupant.name : null,
    );
    const houseNames = names.filter((name): name is string => name !== null);
    expect(houseNames).toHaveLength(3);
    expect(new Set(houseNames).size).toBe(3);
  });

  it('does not repeat a name the host filled by hand', () => {
    let room = createRoom({ hostId: 'p-host', hostName: 'Cory', at: T0, seed: 'names-2' });
    room = run(
      room,
      { type: 'FILL_SEAT', playerId: 'p-host', seat: 1, difficulty: 'lolo', at: T0 },
      { type: 'FILL_SEAT', playerId: 'p-host', seat: 2, difficulty: 'lolo', at: T0 },
      { type: 'START', playerId: 'p-host', at: T0 },
    );
    const houseNames = room.seats
      .map((occupant) => (occupant.kind === 'ai' ? occupant.name : null))
      .filter((name): name is string => name !== null);
    expect(new Set(houseNames).size).toBe(houseNames.length);
  });
});
