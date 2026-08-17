/**
 * The game state machine.
 *
 *   reduce(state, action) -> state
 *   legalActions(state, seat) -> Action[]
 *
 * `legalActions` is the backbone of the entire UX: the UI never guesses what
 * the player can do, it asks the engine and renders the answer. The same
 * function drives the AI.
 *
 * The engine is deterministic and free of wall-clock time. The claim window the
 * player sees is a UI-layer timer that dispatches PASS on their behalf.
 */

import {
  chowOptions,
  claimOptions,
  kangOption,
  nextSeat,
  pungOption,
  resolveClaims,
  SEATS,
  seatsWithClaims,
  todasOption,
} from './calls.js';
import {
  concealedKangFaces,
  countFace,
  expectedTileCount,
  handTileCount,
  isWinningHand,
} from './hand.js';
import { cloneRuleset, STANDARD } from './rulesets.js';
import { buildImmediatePayout, drawSettlement, round2, settle } from './scoring.js';
import { isFlower, isSuited, sortTiles } from './tiles.js';
import type {
  Action,
  AmbitionId,
  Face,
  FlowerTile,
  GameEvent,
  GamePhase,
  GameState,
  Meld,
  PlayerState,
  Rank,
  Ruleset,
  SeatId,
  Suit,
  Tile,
} from './types.js';
import {
  breakPoint,
  buildWall,
  isDoubles,
  rollDice,
  takeFromDrawWall,
  takeFromFlowerWall,
  wallExhausted,
  wallRemaining,
  WALL_SIZE,
} from './wall.js';

export type NewGameOptions = {
  seed: string;
  ruleset?: Ruleset;
  dealerSeat?: SeatId;
  round?: number;
  handNumber?: number;
  chips?: [number, number, number, number];
  /** Jai alái markers carried in from the previous hand. */
  markers?: [number, number, number, number];
  /** The jai alái pot carried in. Zero triggers a fresh ante when enabled. */
  pot?: number;
};

function emptyPlayer(seat: SeatId, isDealer: boolean, chips: number): PlayerState {
  return {
    seat,
    concealed: [],
    melds: [],
    flowers: [],
    isDealer,
    chips,
    everDrewFlower: false,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    ruleset: cloneRuleset(state.ruleset),
    wall: state.wall,
    players: state.players.map((p) => ({
      ...p,
      concealed: [...p.concealed],
      melds: p.melds.map((m) => ({ ...m, tiles: [...m.tiles] })) as Meld[],
      flowers: [...p.flowers],
    })) as GameState['players'],
    discards: state.discards.map((d) => ({ ...d })),
    markers: [...state.markers] as [number, number, number, number],
    immediate: [...state.immediate],
    history: [...state.history],
    events: [],
    phase: clonePhase(state.phase),
  };
}

function clonePhase(phase: GamePhase): GamePhase {
  if (phase.name === 'PENDING_CLAIMS') {
    return {
      ...phase,
      eligible: [...phase.eligible],
      claims: phase.claims.map((c) => ({ ...c, tileIds: [...c.tileIds] })),
      passed: [...phase.passed],
    };
  }
  return { ...phase };
}

function payImmediate(state: GameState, seat: SeatId, ambition: AmbitionId): void {
  const payout = buildImmediatePayout(state, seat, ambition);
  if (payout.value === 0) return;
  for (const other of SEATS) {
    if (other === seat) continue;
    state.players[other].chips = round2(state.players[other].chips - payout.value);
  }
  state.players[seat].chips = round2(state.players[seat].chips + payout.amount);
  state.immediate.push(payout);
  state.events.push({ type: 'IMMEDIATE_PAYOUT', payout });
}

/** Expose a flower, draw a replacement, repeat until a non-flower arrives. */
function resolveFlowers(state: GameState, seat: SeatId, tile: Tile | null): Tile | null {
  let current = tile;
  const player = state.players[seat];
  while (current && isFlower(current)) {
    const flower = current as FlowerTile;
    player.flowers.push(flower);
    player.everDrewFlower = true;
    const threshold = state.ruleset.thirteenFlowersThreshold;
    if (threshold > 0 && player.flowers.length === threshold) {
      payImmediate(state, seat, 'thirteenFlowers');
    }
    const replacement = takeFromFlowerWall(state);
    state.events.push({
      type: 'FLOWER',
      seat,
      tile: flower,
      replacement: replacement ?? flower,
    });
    current = replacement;
  }
  return current;
}

function setJoker(state: GameState): void {
  if (!state.ruleset.jokerEnabled) return;
  // The máno counts down the flower wall and turns one tile face up; if it is a
  // flower, keep turning until a suited tile appears. That face — all four
  // copies — becomes the joker. The turned tile stays in the wall (it is an
  // indicator, not a consumed tile), which keeps tile accounting exact.
  for (let step = 0; step < WALL_SIZE; step++) {
    const index = (state.flowerIndex - step + WALL_SIZE * 2) % WALL_SIZE;
    const tile = state.wall[index];
    if (isSuited(tile)) {
      state.joker = { suit: tile.suit, rank: tile.rank };
      state.events.push({ type: 'JOKER_SET', face: state.joker });
      return;
    }
  }
}

export function createGame(options: NewGameOptions): GameState {
  const {
    seed,
    ruleset = cloneRuleset(STANDARD),
    dealerSeat = 0,
    round = 1,
    handNumber = 1,
    chips = [0, 0, 0, 0],
    markers = [0, 0, 0, 0],
    pot = 0,
  } = options;

  const dice = rollDice(seed, handNumber);
  const wall = buildWall(`${seed}:${handNumber}`);
  const breakIndex = breakPoint(dealerSeat, dice);

  const state: GameState = {
    seed,
    ruleset,
    wall,
    breakIndex,
    drawIndex: breakIndex,
    flowerIndex: (breakIndex - 1 + WALL_SIZE) % WALL_SIZE,
    drawnFromWall: 0,
    giftsDrawn: 0,
    dice,
    joker: null,
    players: SEATS.map((seat) =>
      emptyPlayer(seat, seat === dealerSeat, chips[seat]),
    ) as GameState['players'],
    discards: [],
    phase: { name: 'DEALING' },
    round,
    handNumber,
    dealerSeat,
    doublesActive: ruleset.doublesOnDoubleRoll && isDoubles(dice),
    markers: [...markers] as [number, number, number, number],
    pot,
    immediate: [],
    history: [],
    events: [],
    pendingKang: null,
  };

  // Jai alái: with no pot on the table, everyone antes before the deal —
  // at the start of a session, and again after someone sweeps the pot.
  if (ruleset.jaiAlai.enabled && state.pot === 0 && ruleset.jaiAlai.ante > 0) {
    for (const seat of SEATS) {
      state.players[seat].chips = round2(state.players[seat].chips - ruleset.jaiAlai.ante);
    }
    state.pot = round2(ruleset.jaiAlai.ante * 4);
  }

  // Deal: 8 tiles twice around, counterclockwise from the máno, then the máno
  // takes a 17th tile and will discard first.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 4; i++) {
      const seat = ((dealerSeat + i) % 4) as SeatId;
      for (let n = 0; n < 8; n++) {
        const tile = takeFromDrawWall(state);
        if (tile) state.players[seat].concealed.push(tile);
      }
    }
  }
  const extra = takeFromDrawWall(state);
  if (extra) state.players[dealerSeat].concealed.push(extra);
  state.events.push({ type: 'DEALT' });

  // Flower replacement, starting with the máno, until nobody holds a flower.
  for (let sweep = 0; sweep < 40; sweep++) {
    let replacedAny = false;
    for (let i = 0; i < 4; i++) {
      const seat = ((dealerSeat + i) % 4) as SeatId;
      const player = state.players[seat];
      for (let index = 0; index < player.concealed.length; index++) {
        const tile = player.concealed[index];
        if (!isFlower(tile)) continue;
        replacedAny = true;
        const replacement = resolveFlowers(state, seat, tile);
        if (replacement) {
          player.concealed[index] = replacement;
        } else {
          player.concealed.splice(index, 1);
          index--;
        }
      }
    }
    if (!replacedAny) break;
  }

  // No Flowers pays at the deal; Thirteen Flowers is handled in resolveFlowers.
  for (const seat of SEATS) {
    if (state.players[seat].flowers.length === 0) payImmediate(state, seat, 'noFlowers');
  }

  setJoker(state);

  // Bisaklát — the máno's dealt hand is already a winning hand.
  const mano = state.players[dealerSeat];
  if (
    isWinningHand({
      concealed: mano.concealed,
      melds: mano.melds,
      joker: state.joker,
      sieteParesRequiresConcealed: ruleset.sieteParesRequiresConcealed,
    })
  ) {
    return endHand(state, {
      state,
      winner: dealerSeat,
      winType: 'bisaklat',
      discarder: null,
      winningTile: null,
      concealedBefore: null,
    });
  }

  state.phase = { name: 'AWAITING_DISCARD', seat: dealerSeat, justDrew: null };
  return state;
}

function endHand(state: GameState, ctx: Parameters<typeof settle>[0]): GameState {
  const settlement = settle({ ...ctx, state });
  for (const transfer of settlement.transfers) {
    state.players[transfer.from].chips = round2(state.players[transfer.from].chips - transfer.amount);
    state.players[transfer.to].chips = round2(state.players[transfer.to].chips + transfer.amount);
  }
  awardMarkers(state, settlement);
  state.phase = { name: 'HAND_OVER', settlement };
  state.events.push({ type: 'HAND_OVER', settlement });
  return state;
}

/**
 * Jai alái markers. Talbog (win on a discard) earns the base marker, búnot and
 * bisaklát earn more, and a hand that carried any ambition beyond the base win
 * earns the ambición bonus. A robbed kang arrives here as winType 'discard',
 * which matches the common table ruling of one marker only.
 */
function awardMarkers(state: GameState, settlement: import('./types.js').Settlement): void {
  const rules = state.ruleset.jaiAlai;
  if (!rules.enabled || settlement.winner === null) return;

  const winner = settlement.winner;
  const awards = rules.markerAwards;
  let markers =
    settlement.winType === 'bisaklat'
      ? awards.bisaklat
      : settlement.winType === 'bunot'
        ? awards.bunot
        : awards.win;
  let reason =
    settlement.winType === 'bisaklat' ? 'Bisaklát' : settlement.winType === 'bunot' ? 'Búnot' : 'Talbog';

  // Only the table's "majors" earn the bonus marker — by default siete pares,
  // total pong (all pungs) and escaléra, so a major win lands on 2.
  const hasMajor = settlement.items.some((item) => rules.majors.includes(item.ambition));
  if (hasMajor && awards.ambitionBonus > 0) {
    markers += awards.ambitionBonus;
    reason += ' ambición';
  }
  if (markers <= 0) return;

  state.markers[winner] += markers;
  settlement.markerAward = { seat: winner, markers, reason };

  if (state.markers[winner] >= rules.markersToWin && state.pot > 0) {
    settlement.potWin = { seat: winner, amount: state.pot };
    state.players[winner].chips = round2(state.players[winner].chips + state.pot);
    state.pot = 0;
    state.markers = [0, 0, 0, 0];
  }
}

function endHandDrawn(state: GameState): GameState {
  const settlement = drawSettlement(state);
  state.phase = { name: 'HAND_OVER', settlement };
  state.events.push({ type: 'WALL_EXHAUSTED' });
  state.events.push({ type: 'HAND_OVER', settlement });
  return state;
}

function removeTiles(player: PlayerState, tileIds: string[]): Tile[] {
  const taken: Tile[] = [];
  for (const id of tileIds) {
    const index = player.concealed.findIndex((t) => t.id === id);
    if (index === -1) throw new Error(`tile not in hand: ${id}`);
    taken.push(player.concealed[index]);
    player.concealed.splice(index, 1);
  }
  return taken;
}

function removeFaceTiles(player: PlayerState, face: Face, howMany: number): Tile[] {
  const ids = player.concealed
    .filter((t) => isSuited(t) && t.suit === face.suit && t.rank === face.rank)
    .slice(0, howMany)
    .map((t) => t.id);
  if (ids.length < howMany) throw new Error('not enough matching tiles');
  return removeTiles(player, ids);
}

/** Draw a gift tile from the flower wall, replacing flowers recursively. */
function drawGift(state: GameState, seat: SeatId): Tile | null {
  const first = takeFromFlowerWall(state);
  const tile = resolveFlowers(state, seat, first);
  if (tile) {
    state.players[seat].concealed.push(tile);
    state.events.push({ type: 'DREW', seat, tile, fromGiftWall: true });
  }
  return tile;
}

function beginClaimWindow(state: GameState, discard: Tile, from: SeatId): void {
  const eligible = SEATS.filter((seat) => seat !== from);
  const withClaims = seatsWithClaims(state, discard, from);
  const passed = eligible.filter((seat) => !withClaims.includes(seat));
  state.phase = {
    name: 'PENDING_CLAIMS',
    discard,
    from,
    eligible,
    claims: [],
    passed,
  };
  if (passed.length === eligible.length) resolvePendingClaims(state);
}

function advanceTurn(state: GameState, seat: SeatId): void {
  if (wallExhausted(state)) {
    endHandDrawn(state);
    return;
  }
  state.phase = { name: 'AWAITING_DRAW', seat };
}

function completeSagasa(state: GameState, seat: SeatId, face: Face): void {
  const player = state.players[seat];
  const pung = player.melds.find(
    (m) =>
      m.type === 'pung' &&
      m.tiles.some((t) => isSuited(t) && t.suit === face.suit && t.rank === face.rank),
  );
  if (!pung || pung.type !== 'pung') throw new Error('no exposed pung to extend');
  const [fourth] = removeFaceTiles(player, face, 1);
  const index = player.melds.indexOf(pung);
  player.melds[index] = {
    type: 'kang',
    tiles: [...pung.tiles, fourth] as [Tile, Tile, Tile, Tile],
    variant: 'sagasa',
    claimedFrom: pung.claimedFrom,
  };
  state.events.push({ type: 'KANG_DECLARED', seat, variant: 'sagasa', face });
  payImmediate(state, seat, 'sagasa');
  const gift = drawGift(state, seat);
  state.pendingKang = null;
  state.phase = { name: 'AWAITING_DISCARD', seat, justDrew: gift };
}

function resolvePendingClaims(state: GameState): void {
  const phase = state.phase;
  if (phase.name !== 'PENDING_CLAIMS') return;

  const { winners } = resolveClaims(
    phase.claims,
    phase.from,
    state.ruleset.multipleWinnersOnDiscard,
  );

  // Robbing the kang: only a tódas claim matters here.
  if (phase.robbingKang) {
    const robber = winners.find((w) => w.call === 'todas');
    if (robber) {
      const winner = state.players[robber.seat];
      const before = [...winner.concealed];
      winner.concealed.push(phase.discard);
      endHand(state, {
        state,
        winner: robber.seat,
        winType: 'discard',
        discarder: phase.robbingKang.seat,
        winningTile: phase.discard,
        concealedBefore: before,
      });
      return;
    }
    completeSagasa(state, phase.robbingKang.seat, phase.robbingKang.face);
    return;
  }

  if (winners.length === 0) {
    advanceTurn(state, nextSeat(phase.from));
    return;
  }

  const claim = winners[0];
  const claimer = state.players[claim.seat];

  if (claim.call === 'todas') {
    const before = [...claimer.concealed];
    claimer.concealed.push(phase.discard);
    markDiscardClaimed(state);
    state.events.push({
      type: 'CALLED',
      seat: claim.seat,
      call: 'todas',
      tile: phase.discard,
      from: phase.from,
    });
    endHand(state, {
      state,
      winner: claim.seat,
      winType: 'discard',
      discarder: phase.from,
      winningTile: phase.discard,
      concealedBefore: before,
    });
    return;
  }

  const taken = removeTiles(claimer, claim.tileIds);
  markDiscardClaimed(state);

  if (claim.call === 'chow') {
    claimer.melds.push({
      type: 'chow',
      tiles: [phase.discard, ...taken] as [Tile, Tile, Tile],
      claimedFrom: phase.from,
    });
  } else if (claim.call === 'pung') {
    claimer.melds.push({
      type: 'pung',
      tiles: [phase.discard, ...taken] as [Tile, Tile, Tile],
      claimedFrom: phase.from,
    });
  } else {
    claimer.melds.push({
      type: 'kang',
      tiles: [phase.discard, ...taken] as [Tile, Tile, Tile, Tile],
      variant: 'open',
      claimedFrom: phase.from,
    });
  }

  state.events.push({
    type: 'CALLED',
    seat: claim.seat,
    call: claim.call,
    tile: phase.discard,
    from: phase.from,
  });

  let gift: Tile | null = null;
  if (claim.call === 'kang') {
    payImmediate(state, claim.seat, 'openKang');
    gift = drawGift(state, claim.seat);
  }

  state.phase = { name: 'AWAITING_DISCARD', seat: claim.seat, justDrew: gift };
}

function markDiscardClaimed(state: GameState): void {
  const last = state.discards[state.discards.length - 1];
  if (last) last.claimed = true;
}

function finishClaimWindowIfComplete(state: GameState): void {
  const phase = state.phase;
  if (phase.name !== 'PENDING_CLAIMS') return;
  if (phase.claims.length + phase.passed.length >= phase.eligible.length) {
    resolvePendingClaims(state);
  }
}

export function reduce(state: GameState, action: Action): GameState {
  const next = cloneState(state);
  next.history.push(action);
  apply(next, action);
  return next;
}

function apply(state: GameState, action: Action): void {
  const phase = state.phase;

  switch (action.type) {
    case 'DRAW': {
      if (phase.name !== 'AWAITING_DRAW' || phase.seat !== action.seat) {
        throw new Error('illegal DRAW');
      }
      const drawn = takeFromDrawWall(state);
      if (!drawn) {
        endHandDrawn(state);
        return;
      }
      const tile = resolveFlowers(state, action.seat, drawn);
      if (!tile) {
        endHandDrawn(state);
        return;
      }
      state.players[action.seat].concealed.push(tile);
      state.events.push({ type: 'DREW', seat: action.seat, tile, fromGiftWall: false });
      state.phase = { name: 'AWAITING_DISCARD', seat: action.seat, justDrew: tile };
      return;
    }

    case 'DISCARD': {
      if (phase.name !== 'AWAITING_DISCARD' || phase.seat !== action.seat) {
        throw new Error('illegal DISCARD');
      }
      const player = state.players[action.seat];
      const [tile] = removeTiles(player, [action.tileId]);
      state.discards.push({ tile, from: action.seat, claimed: false });
      state.events.push({ type: 'DISCARDED', seat: action.seat, tile });
      beginClaimWindow(state, tile, action.seat);
      return;
    }

    case 'CLAIM': {
      if (phase.name !== 'PENDING_CLAIMS') throw new Error('illegal CLAIM: no window open');
      if (!phase.eligible.includes(action.seat)) throw new Error('illegal CLAIM: seat not eligible');
      if (
        phase.passed.includes(action.seat) ||
        phase.claims.some((c) => c.seat === action.seat)
      ) {
        throw new Error('illegal CLAIM: seat already responded');
      }
      const options = phase.robbingKang
        ? robbingOptions(state, action.seat, phase.discard)
        : claimOptions(state, action.seat, phase.discard, phase.from);
      const match = options.find(
        (o) => o.call === action.call && sameIds(o.tileIds, action.tileIds),
      );
      if (!match) throw new Error(`illegal CLAIM: ${action.call} not available`);
      phase.claims.push({ seat: action.seat, call: action.call, tileIds: action.tileIds });
      finishClaimWindowIfComplete(state);
      return;
    }

    case 'PASS': {
      if (phase.name !== 'PENDING_CLAIMS') throw new Error('illegal PASS: no window open');
      if (!phase.eligible.includes(action.seat)) throw new Error('illegal PASS: seat not eligible');
      if (phase.passed.includes(action.seat) || phase.claims.some((c) => c.seat === action.seat)) {
        return; // idempotent: a UI timer and the player may both send PASS
      }
      phase.passed.push(action.seat);
      finishClaimWindowIfComplete(state);
      return;
    }

    case 'SECRET_KANG': {
      if (phase.name !== 'AWAITING_DISCARD' || phase.seat !== action.seat) {
        throw new Error('illegal SECRET_KANG');
      }
      const face: Face = { suit: action.suit, rank: action.rank };
      const player = state.players[action.seat];
      if (countFace(player.concealed, face) < 4) throw new Error('illegal SECRET_KANG: need four');
      if (wallExhausted(state)) throw new Error('illegal SECRET_KANG: no gift tile');
      const tiles = removeFaceTiles(player, face, 4);
      player.melds.push({
        type: 'kang',
        tiles: tiles as [Tile, Tile, Tile, Tile],
        variant: 'secret',
        claimedFrom: null,
      });
      state.events.push({ type: 'KANG_DECLARED', seat: action.seat, variant: 'secret', face });
      payImmediate(state, action.seat, 'secretKang');
      const gift = drawGift(state, action.seat);
      state.phase = { name: 'AWAITING_DISCARD', seat: action.seat, justDrew: gift };
      return;
    }

    case 'SAGASA': {
      if (phase.name !== 'AWAITING_DISCARD' || phase.seat !== action.seat) {
        throw new Error('illegal SAGASA');
      }
      const face: Face = { suit: action.suit, rank: action.rank };
      if (!canSagasa(state, action.seat, face)) throw new Error('illegal SAGASA');

      if (state.ruleset.robbingTheKang) {
        const robbers = SEATS.filter((seat) => {
          if (seat === action.seat) return false;
          return robbingOptions(state, seat, faceAsTile(state, action.seat, face)).length > 0;
        });
        if (robbers.length > 0) {
          const tile = state.players[action.seat].concealed.find(
            (t) => isSuited(t) && t.suit === face.suit && t.rank === face.rank,
          )!;
          state.pendingKang = { seat: action.seat, face };
          state.phase = {
            name: 'PENDING_CLAIMS',
            discard: tile,
            from: action.seat,
            eligible: robbers,
            claims: [],
            passed: [],
            robbingKang: { seat: action.seat, face },
          };
          return;
        }
      }
      completeSagasa(state, action.seat, face);
      return;
    }

    case 'DECLARE_TODAS': {
      if (phase.name !== 'AWAITING_DISCARD' || phase.seat !== action.seat) {
        throw new Error('illegal DECLARE_TODAS');
      }
      const player = state.players[action.seat];
      if (
        !isWinningHand({
          concealed: player.concealed,
          melds: player.melds,
          joker: state.joker,
          sieteParesRequiresConcealed: state.ruleset.sieteParesRequiresConcealed,
        })
      ) {
        throw new Error('illegal DECLARE_TODAS: hand is not complete');
      }
      // Any tile taken from the wall — draw wall or flower wall — is a búnot.
      const winningTile = phase.justDrew ?? player.concealed[player.concealed.length - 1];
      const before = player.concealed.filter((t) => t.id !== winningTile.id);
      endHand(state, {
        state,
        winner: action.seat,
        winType: 'bunot',
        discarder: null,
        winningTile,
        concealedBefore: before,
      });
      return;
    }

    default: {
      const never: never = action;
      throw new Error(`unknown action ${JSON.stringify(never)}`);
    }
  }
}

function faceAsTile(state: GameState, seat: SeatId, face: Face): Tile {
  const tile = state.players[seat].concealed.find(
    (t) => isSuited(t) && t.suit === face.suit && t.rank === face.rank,
  );
  if (!tile) throw new Error('face not held');
  return tile;
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

/** During a robbing-the-kang window, tódas is the only claim on offer. */
function robbingOptions(state: GameState, seat: SeatId, tile: Tile) {
  const option = todasOption(
    state.players[seat],
    tile,
    state.joker,
    state.ruleset.sieteParesRequiresConcealed,
  );
  return option ? [option] : [];
}

export function canSagasa(state: GameState, seat: SeatId, face: Face): boolean {
  if (wallExhausted(state)) return false;
  const player = state.players[seat];
  if (countFace(player.concealed, face) < 1) return false;
  return player.melds.some(
    (m) =>
      m.type === 'pung' &&
      m.tiles.some((t) => isSuited(t) && t.suit === face.suit && t.rank === face.rank),
  );
}

export function legalActions(state: GameState, seat: SeatId): Action[] {
  const phase = state.phase;
  const out: Action[] = [];
  const player = state.players[seat];

  switch (phase.name) {
    case 'AWAITING_DRAW': {
      if (phase.seat === seat && !wallExhausted(state)) out.push({ type: 'DRAW', seat });
      return out;
    }
    case 'AWAITING_DISCARD': {
      if (phase.seat !== seat) return out;

      if (
        isWinningHand({
          concealed: player.concealed,
          melds: player.melds,
          joker: state.joker,
          sieteParesRequiresConcealed: state.ruleset.sieteParesRequiresConcealed,
        })
      ) {
        out.push({ type: 'DECLARE_TODAS', seat });
      }

      if (!wallExhausted(state)) {
        for (const face of concealedKangFaces(player.concealed)) {
          out.push({ type: 'SECRET_KANG', seat, suit: face.suit, rank: face.rank });
        }
        for (const meld of player.melds) {
          if (meld.type !== 'pung') continue;
          const tile = meld.tiles.find(isSuited);
          if (!tile) continue;
          const face: Face = { suit: tile.suit, rank: tile.rank };
          if (canSagasa(state, seat, face)) {
            out.push({ type: 'SAGASA', seat, suit: face.suit, rank: face.rank });
          }
        }
      }

      for (const tile of player.concealed) {
        out.push({ type: 'DISCARD', seat, tileId: tile.id });
      }
      return out;
    }
    case 'PENDING_CLAIMS': {
      if (!phase.eligible.includes(seat)) return out;
      if (phase.passed.includes(seat) || phase.claims.some((c) => c.seat === seat)) return out;
      const options = phase.robbingKang
        ? robbingOptions(state, seat, phase.discard)
        : claimOptions(state, seat, phase.discard, phase.from);
      for (const option of options) {
        out.push({ type: 'CLAIM', seat, call: option.call, tileIds: option.tileIds });
      }
      out.push({ type: 'PASS', seat });
      return out;
    }
    default:
      return out;
  }
}

/** Whose action the table is waiting on, if it is waiting on exactly one seat. */
export function currentSeat(state: GameState): SeatId | null {
  const phase = state.phase;
  if (phase.name === 'AWAITING_DRAW' || phase.name === 'AWAITING_DISCARD') return phase.seat;
  return null;
}

export function seatsAwaitingClaimResponse(state: GameState): SeatId[] {
  const phase = state.phase;
  if (phase.name !== 'PENDING_CLAIMS') return [];
  return phase.eligible.filter(
    (seat) => !phase.passed.includes(seat) && !phase.claims.some((c) => c.seat === seat),
  );
}

export function isHandOver(state: GameState): boolean {
  return state.phase.name === 'HAND_OVER';
}

export function tilesRemaining(state: GameState): number {
  return wallRemaining(state);
}

/**
 * Start the next hand. The máno retains the dealership on a win (including a
 * bisaklát); on any other outcome it passes counterclockwise. On a draw the
 * `drawEndsDealership` flag decides.
 */
export function nextHand(state: GameState): GameState {
  const phase = state.phase;
  if (phase.name !== 'HAND_OVER') throw new Error('hand is not over');
  const settlement = phase.settlement;

  const dealerRetains =
    settlement.winner === state.dealerSeat
      ? true
      : settlement.winType === 'draw'
        ? !state.ruleset.drawEndsDealership
        : false;

  const dealerSeat = dealerRetains ? state.dealerSeat : nextSeat(state.dealerSeat);
  const round = dealerRetains || dealerSeat !== 0 ? state.round : state.round + 1;

  return createGame({
    seed: state.seed,
    ruleset: cloneRuleset(state.ruleset),
    dealerSeat,
    round,
    handNumber: state.handNumber + 1,
    chips: state.players.map((p) => p.chips) as [number, number, number, number],
    markers: [...state.markers] as [number, number, number, number],
    pot: state.pot,
  });
}

/**
 * The rack belongs to the player. These two are the only ways its order ever
 * changes, both of them explicit: a drag, or a tap on Sort. Nothing sorts by
 * itself.
 */
export function reorderRack(state: GameState, seat: SeatId, from: number, to: number): GameState {
  const next = cloneState(state);
  const rack = next.players[seat].concealed;
  if (from < 0 || from >= rack.length || to < 0 || to >= rack.length) return state;
  const [moved] = rack.splice(from, 1);
  rack.splice(to, 0, moved);
  return next;
}

export function sortRack(state: GameState, seat: SeatId): GameState {
  const next = cloneState(state);
  next.players[seat].concealed = sortTiles(next.players[seat].concealed);
  return next;
}

export function isSessionOver(state: GameState): boolean {
  return state.round > state.ruleset.roundsPerGame;
}

/** Convenience for the UI and tests: does this seat hold a legal call right now? */
export function hasLegalCall(state: GameState, seat: SeatId): boolean {
  return legalActions(state, seat).some((a) => a.type === 'CLAIM');
}

export function handInvariantHolds(state: GameState): boolean {
  return state.players.every((p) => {
    const expected = expectedTileCount(p.melds);
    const actual = handTileCount(p.concealed, p.melds);
    const phase = state.phase;
    const awaitingDiscard = phase.name === 'AWAITING_DISCARD' && phase.seat === p.seat;
    return awaitingDiscard ? actual === expected : actual === expected - 1;
  });
}

export type { Suit, Rank };
export { chowOptions, claimOptions, kangOption, pungOption, nextSeat };
