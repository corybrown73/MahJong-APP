import {
  cloneRuleset,
  createGame,
  createRng,
  currentSeat,
  legalActions,
  nextHand as engineNextHand,
  publicView,
  reduce,
  seatsAwaitingClaimResponse,
  STANDARD,
  type Action,
  type Ruleset,
  type SeatId,
  type Settlement,
} from '@bahay/engine';
import { decide, PERSONALITIES, type Difficulty } from '@bahay/ai';
import type {
  CommandResult,
  Occupant,
  PlayerId,
  Room,
  RoomCommand,
  RoomEvent,
  RoomView,
  SeatView,
} from './types.js';

export const SEATS: SeatId[] = [0, 1, 2, 3];

/** How long a claim window stays open online. Longer than solo: people and networks. */
export const CLAIM_WINDOW_MS = 4_000;
/** How long the table waits for a dropped player before the AI covers for them. */
export const DISCONNECT_GRACE_MS = 8_000;
/** How long their seat is held before anyone else may take it. */
export const SEAT_HOLD_MS = 90_000;
/** A beat before a player's own draw, so they see the tile arrive. */
export const AUTO_DRAW_MS = 400;
/** Keep the tail of the event log; clients only animate what just happened. */
export const EVENT_LOG_LIMIT = 40;

/** No O/0 or I/1 — these get read aloud over the phone. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(seed: string): string {
  const rng = createRng(`room-code:${seed}`);
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[rng.int(CODE_ALPHABET.length)];
  return code;
}

export function occupantName(occupant: Occupant): string {
  if (occupant.kind === 'human') return occupant.name;
  if (occupant.kind === 'ai') return occupant.name;
  return 'Open seat';
}

export function seatOf(room: Room, playerId: PlayerId): SeatId | null {
  for (const seat of SEATS) {
    const occupant = room.seats[seat];
    if (occupant.kind === 'human' && occupant.playerId === playerId) return seat;
  }
  return null;
}

export function createRoom(options: {
  code?: string;
  hostId: PlayerId;
  hostName: string;
  ruleset?: Ruleset;
  seed?: string;
  at: number;
}): Room {
  const seed = options.seed ?? `room-${options.at}-${options.hostId}`;
  const room: Room = {
    code: options.code ?? generateRoomCode(seed),
    hostId: options.hostId,
    ruleset: cloneRuleset(options.ruleset ?? STANDARD),
    seats: [
      { kind: 'human', playerId: options.hostId, name: options.hostName, connected: true, lastSeenAt: options.at },
      { kind: 'open' },
      { kind: 'open' },
      { kind: 'open' },
    ],
    status: 'lobby',
    game: null,
    seed,
    version: 1,
    createdAt: options.at,
    updatedAt: options.at,
    phaseSince: options.at,
    phaseKey: 'lobby',
    claimDeadline: null,
    nextActionAt: null,
    events: [],
  };
  return room;
}

function clone(room: Room): Room {
  return {
    ...room,
    ruleset: cloneRuleset(room.ruleset),
    seats: [...room.seats] as Room['seats'],
    events: [...room.events],
  };
}

function push(room: Room, event: RoomEvent): void {
  room.events = [...room.events, event].slice(-EVENT_LOG_LIMIT);
}

function fail(room: Room, error: string): CommandResult {
  return { room, error, changed: false };
}

function accept(room: Room, at: number): CommandResult {
  room.version += 1;
  room.updatedAt = at;
  return { room, changed: true };
}

/**
 * Every command goes through here — on the server, this is the authority. The
 * two rules that matter most: only the host may change the shape of the table,
 * and nobody may act for a seat they do not occupy.
 */
export function applyCommand(input: Room, command: RoomCommand): CommandResult {
  const room = clone(input);
  const at = command.at;

  switch (command.type) {
    case 'JOIN': {
      const existing = seatOf(room, command.playerId);
      if (existing !== null) {
        const occupant = room.seats[existing];
        if (occupant.kind !== 'human') return fail(input, 'seat is not yours');
        room.seats[existing] = { ...occupant, connected: true, lastSeenAt: at, name: command.name };
        push(room, { type: 'RECONNECTED', seat: existing, name: command.name, at });
        return finish(room, at);
      }
      const open = SEATS.find((seat) => canTakeSeat(room, seat, at));
      if (open === undefined) return fail(input, 'the table is full');
      room.seats[open] = {
        kind: 'human',
        playerId: command.playerId,
        name: command.name,
        connected: true,
        lastSeenAt: at,
      };
      push(room, { type: 'JOINED', seat: open, name: command.name, at });
      return finish(room, at);
    }

    case 'LEAVE': {
      const seat = seatOf(room, command.playerId);
      if (seat === null) return fail(input, 'you are not seated');
      const occupant = room.seats[seat];
      if (occupant.kind !== 'human') return fail(input, 'seat is not yours');
      if (room.status === 'lobby') {
        room.seats[seat] = { kind: 'open' };
      } else {
        // Mid-hand: hold the seat and let the AI cover, so the table plays on.
        room.seats[seat] = { ...occupant, connected: false, lastSeenAt: at };
      }
      push(room, { type: 'LEFT', seat, name: occupant.name, at });
      return finish(room, at);
    }

    case 'SIT': {
      if (room.status !== 'lobby') return fail(input, 'the hand has started');
      const current = seatOf(room, command.playerId);
      if (current === null) return fail(input, 'you are not seated');
      if (!canTakeSeat(room, command.seat, at)) return fail(input, 'that seat is taken');
      const occupant = room.seats[current];
      room.seats[current] = { kind: 'open' };
      room.seats[command.seat] = occupant;
      return finish(room, at);
    }

    case 'FILL_SEAT': {
      if (command.playerId !== room.hostId) return fail(input, 'only the host may fill a seat');
      if (room.status !== 'lobby') return fail(input, 'the hand has started');
      if (room.seats[command.seat].kind === 'human') return fail(input, 'someone is sitting there');
      const name = PERSONALITIES[command.difficulty].name;
      room.seats[command.seat] = { kind: 'ai', difficulty: command.difficulty, name };
      push(room, { type: 'SEAT_FILLED', seat: command.seat, name, at });
      return finish(room, at);
    }

    case 'OPEN_SEAT': {
      if (command.playerId !== room.hostId) return fail(input, 'only the host may open a seat');
      if (room.status !== 'lobby') return fail(input, 'the hand has started');
      if (room.seats[command.seat].kind === 'human') return fail(input, 'someone is sitting there');
      room.seats[command.seat] = { kind: 'open' };
      return finish(room, at);
    }

    case 'SET_RULESET': {
      if (command.playerId !== room.hostId) return fail(input, 'only the host sets the rules');
      if (room.status !== 'lobby') return fail(input, 'the hand has started');
      room.ruleset = cloneRuleset(command.ruleset);
      return finish(room, at);
    }

    case 'START': {
      if (command.playerId !== room.hostId) return fail(input, 'only the host may start');
      if (room.status !== 'lobby') return fail(input, 'already started');
      // Any seat still open when the host starts is filled by the house.
      for (const seat of SEATS) {
        if (room.seats[seat].kind === 'open') {
          room.seats[seat] = {
            kind: 'ai',
            difficulty: 'kapitbahay',
            name: PERSONALITIES.kapitbahay.name,
          };
        }
      }
      room.game = createGame({ seed: `${room.seed}:1`, ruleset: cloneRuleset(room.ruleset) });
      room.status = 'playing';
      markPhase(room, at);
      push(room, { type: 'STARTED', at });
      noteHandOver(room, at);
      return finish(room, at);
    }

    case 'GAME_ACTION': {
      if (room.status !== 'playing' || !room.game) return fail(input, 'no hand in progress');
      const seat = seatOf(room, command.playerId);
      if (seat === null) return fail(input, 'you are not seated');
      // The whole point of a server: you may only ever act for your own seat.
      if (command.action.seat !== seat) return fail(input, 'that is not your seat');
      const applied = applyGameAction(room, command.action, at);
      if (!applied) return fail(input, 'illegal action');
      touch(room, seat, at);
      return finish(room, at);
    }

    case 'NEXT_HAND': {
      if (command.playerId !== room.hostId) return fail(input, 'only the host deals the next hand');
      if (!room.game || room.game.phase.name !== 'HAND_OVER') return fail(input, 'the hand is not over');
      room.game = engineNextHand(room.game);
      markPhase(room, at);
      return finish(room, at);
    }

    case 'TICK':
      return finish(room, at, tick(room, at));

    default: {
      const never: never = command;
      return fail(input, `unknown command ${JSON.stringify(never)}`);
    }
  }
}

function finish(room: Room, at: number, changedByTick = true): CommandResult {
  recomputeTimers(room, at);
  if (!changedByTick) return { room, changed: false };
  return accept(room, at);
}

function canTakeSeat(room: Room, seat: SeatId, at: number): boolean {
  const occupant = room.seats[seat];
  if (occupant.kind === 'open') return true;
  if (occupant.kind === 'ai') return room.status === 'lobby';
  // A disconnected player keeps their seat until the hold expires.
  return !occupant.connected && at - occupant.lastSeenAt > SEAT_HOLD_MS;
}

function touch(room: Room, seat: SeatId, at: number): void {
  const occupant = room.seats[seat];
  if (occupant.kind === 'human') {
    room.seats[seat] = { ...occupant, connected: true, lastSeenAt: at };
  }
}

function applyGameAction(room: Room, action: Action, at: number): boolean {
  if (!room.game) return false;
  const legal = legalActions(room.game, action.seat).some((option) => sameAction(option, action));
  if (!legal) return false;
  try {
    room.game = reduce(room.game, action);
  } catch {
    return false;
  }
  markPhase(room, at);
  push(room, { type: 'GAME', seat: action.seat, action, at });
  noteHandOver(room, at);
  return true;
}

/**
 * What the table is waiting on right now. A pending claim window is keyed on
 * the discard itself: every seat in that window shares one deadline measured
 * from the moment the tile hit the table, so an opponent answering quickly
 * never shortens — or lengthens — anyone else's beat.
 */
function phaseKeyOf(room: Room): string {
  const game = room.game;
  if (!game) return `${room.status}`;
  const phase = game.phase;
  switch (phase.name) {
    case 'PENDING_CLAIMS':
      return `claims:${game.handNumber}:${phase.from}:${phase.discard.id}`;
    case 'AWAITING_DRAW':
      return `draw:${game.handNumber}:${phase.seat}:${game.history.length}`;
    case 'AWAITING_DISCARD':
      return `discard:${game.handNumber}:${phase.seat}:${game.history.length}`;
    default:
      return `${phase.name}:${game.handNumber}`;
  }
}

/** Restart the clock only when the table is genuinely waiting on something new. */
function markPhase(room: Room, at: number): void {
  const key = phaseKeyOf(room);
  if (key === room.phaseKey) return;
  room.phaseKey = key;
  room.phaseSince = at;
}

function noteHandOver(room: Room, at: number): void {
  if (room.game?.phase.name === 'HAND_OVER') {
    push(room, { type: 'HAND_OVER', settlement: room.game.phase.settlement, at });
  }
}

function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type || a.seat !== b.seat) return false;
  if (a.type === 'DISCARD' && b.type === 'DISCARD') return a.tileId === b.tileId;
  if (a.type === 'CLAIM' && b.type === 'CLAIM') {
    return a.call === b.call && [...a.tileIds].sort().join() === [...b.tileIds].sort().join();
  }
  if ((a.type === 'SECRET_KANG' || a.type === 'SAGASA') && a.type === b.type) {
    return a.suit === b.suit && a.rank === b.rank;
  }
  return true;
}

/** A seat the server should play for: an AI, or a human who has dropped. */
function isCoveredByHouse(room: Room, seat: SeatId, at: number): boolean {
  const occupant = room.seats[seat];
  if (occupant.kind === 'ai') return true;
  if (occupant.kind === 'open') return true;
  return !occupant.connected && at - occupant.lastSeenAt > DISCONNECT_GRACE_MS;
}

function difficultyFor(room: Room, seat: SeatId): Difficulty {
  const occupant = room.seats[seat];
  if (occupant.kind === 'ai') return occupant.difficulty;
  // Covering for someone who dropped: play their hand conservatively.
  return 'lolo';
}

/** The action the house would take for `seat`, and how long it should take. */
export function houseDecision(
  room: Room,
  seat: SeatId,
): { action: Action; thinkMs: number } | null {
  if (!room.game) return null;
  const options = legalActions(room.game, seat);
  if (options.length === 0) return null;
  const personality = PERSONALITIES[difficultyFor(room, seat)];
  const rng = createRng(`${room.seed}:${room.game.handNumber}:${room.game.history.length}:${seat}`);
  const decision = decide(publicView(room.game, seat), options, personality, rng);
  return { action: decision.action, thinkMs: decision.thinkMs };
}

/** Which seats the table is currently waiting on. */
export function waitingSeats(room: Room): SeatId[] {
  if (!room.game || room.status !== 'playing') return [];
  if (room.game.phase.name === 'HAND_OVER') return [];
  const claiming = seatsAwaitingClaimResponse(room.game);
  if (claiming.length > 0) return claiming;
  const seat = currentSeat(room.game);
  return seat === null ? [] : [seat];
}

function recomputeTimers(room: Room, at: number): void {
  room.claimDeadline = null;
  room.nextActionAt = null;
  if (!room.game || room.status !== 'playing' || room.game.phase.name === 'HAND_OVER') return;

  const waiting = waitingSeats(room);
  if (waiting.length === 0) return;

  const house = waiting.filter((seat) => isCoveredByHouse(room, seat, at));
  const humans = waiting.filter((seat) => !isCoveredByHouse(room, seat, at));

  if (house.length > 0) {
    const decision = houseDecision(room, house[0]);
    if (decision) room.nextActionAt = room.phaseSince + decision.thinkMs;
  }

  if (humans.length === 0) return;

  if (room.game.phase.name === 'PENDING_CLAIMS') {
    // A real, visible beat during which their legal calls light up. When it
    // expires the server passes for them — the only thing it ever does on a
    // player's behalf.
    room.claimDeadline = room.phaseSince + CLAIM_WINDOW_MS;
  } else if (room.game.phase.name === 'AWAITING_DRAW') {
    // Drawing is not a decision; take the tile for them after a beat.
    room.nextActionAt = Math.min(room.nextActionAt ?? Infinity, room.phaseSince + AUTO_DRAW_MS);
  }
  // AWAITING_DISCARD for a connected human: no timer at all. Their hand is
  // theirs, and the app never discards for them.
}

/**
 * The heartbeat. Applies every automatic action that has come due: AI moves,
 * covering moves for dropped players, auto-draws, and expired claim windows.
 */
export function tick(room: Room, at: number): boolean {
  if (!room.game || room.status !== 'playing') return false;
  let changed = false;

  for (let guard = 0; guard < 64; guard++) {
    if (!room.game || room.game.phase.name === 'HAND_OVER') break;
    recomputeTimers(room, at);

    const claimExpired = room.claimDeadline !== null && at >= room.claimDeadline;
    const actionDue = room.nextActionAt !== null && at >= room.nextActionAt;
    if (!claimExpired && !actionDue) break;

    if (claimExpired) {
      const waiting = waitingSeats(room).filter((seat) => !isCoveredByHouse(room, seat, at));
      for (const seat of waiting) {
        if (applyGameAction(room, { type: 'PASS', seat }, at)) changed = true;
      }
      continue;
    }

    const waiting = waitingSeats(room);
    const seat = waiting.find((candidate) => isCoveredByHouse(room, candidate, at)) ?? waiting[0];
    if (seat === undefined) break;
    const decision = houseDecision(room, seat);
    if (!decision) break;
    if (!applyGameAction(room, decision.action, at)) break;
    changed = true;
  }

  recomputeTimers(room, at);
  return changed;
}

/**
 * What this player is allowed to see. Concealed hands and the wall order never
 * leave the server; the client gets its own tiles and everyone else's counts.
 */
export function roomView(room: Room, playerId: PlayerId): RoomView {
  const yourSeat = seatOf(room, playerId);
  const seats: SeatView[] = SEATS.map((seat) => {
    const occupant = room.seats[seat];
    return {
      seat,
      name: occupantName(occupant),
      kind: occupant.kind,
      connected: occupant.kind === 'human' ? occupant.connected : occupant.kind === 'ai',
      isHost: occupant.kind === 'human' && occupant.playerId === room.hostId,
      isYou: occupant.kind === 'human' && occupant.playerId === playerId,
    };
  });

  const settlement: Settlement | null =
    room.game?.phase.name === 'HAND_OVER' ? room.game.phase.settlement : null;

  return {
    code: room.code,
    status: room.status,
    version: room.version,
    hostId: room.hostId,
    ruleset: room.ruleset,
    seats,
    yourSeat,
    playerId,
    // A spectator watches from seat 0's chair without seeing its tiles: the
    // view is built for a seat they do not hold, then emptied of the hand.
    game: room.game ? redact(publicView(room.game, yourSeat ?? 0), yourSeat === null) : null,
    settlement,
    claimDeadline: room.claimDeadline,
    events: room.events,
  };
}

function redact<T extends { hand: unknown[] }>(view: T, spectator: boolean): T {
  return spectator ? { ...view, hand: [] } : view;
}
