/**
 * A text harness that plays a full game with no UI at all.
 *
 *   pnpm play              # a random-ish seed
 *   pnpm play my-seed 4    # a named seed, four hands
 *
 * Useful for watching the engine and the AI argue with each other, and for
 * catching a stuck state machine long before any of it reaches a screen.
 */

import {
  createGame,
  createRng,
  currentSeat,
  faceLabel,
  isHandOver,
  legalActions,
  nextHand,
  publicView,
  reduce,
  seatsAwaitingClaimResponse,
  tileLabel,
  tilesRemaining,
  type Action,
  type GameState,
  type SeatId,
} from '@bahay/engine';
import { decide } from './agent.js';
import { DEFAULT_SEATING, PERSONALITIES, type Personality } from './personalities.js';

const seed = process.argv[2] ?? `cli-${Date.now()}`;
const handsToPlay = Number(process.argv[3] ?? 1);

const seats: Record<SeatId, Personality> = {
  0: PERSONALITIES.kapitbahay,
  1: PERSONALITIES[DEFAULT_SEATING[1]],
  2: PERSONALITIES[DEFAULT_SEATING[2]],
  3: PERSONALITIES[DEFAULT_SEATING[3]],
};

const nameOf = (seat: SeatId) => (seat === 0 ? 'You' : seats[seat].name);

function describe(action: Action): string {
  switch (action.type) {
    case 'DISCARD':
      return `discards ${action.tileId}`;
    case 'CLAIM':
      return `calls ${action.call.toUpperCase()}`;
    case 'SECRET_KANG':
      return `declares SECRET on ${faceLabel({ suit: action.suit, rank: action.rank })}`;
    case 'SAGASA':
      return `declares SAGÁSA on ${faceLabel({ suit: action.suit, rank: action.rank })}`;
    case 'DECLARE_TODAS':
      return 'declares TÓDAS';
    default:
      return action.type.toLowerCase();
  }
}

function printEvents(state: GameState): void {
  for (const event of state.events) {
    switch (event.type) {
      case 'FLOWER':
        console.log(`   🌸 ${nameOf(event.seat)} exposes ${event.tile.face} and replaces it`);
        break;
      case 'CALLED':
        console.log(
          `\n   ╔══ ${nameOf(event.seat).toUpperCase()} CALLS ${event.call.toUpperCase()} ` +
            `— ${tileLabel(event.tile)} from ${nameOf(event.from ?? event.seat)} ══╗\n`,
        );
        break;
      case 'KANG_DECLARED':
        console.log(
          `\n   ╔══ ${nameOf(event.seat).toUpperCase()} — ${event.variant.toUpperCase()} KANG ` +
            `on ${faceLabel(event.face)} ══╗\n`,
        );
        break;
      case 'IMMEDIATE_PAYOUT':
        console.log(
          `   💰 ${event.payout.label}: ${nameOf(event.payout.seat)} collects ` +
            `${event.payout.amount.toFixed(2)}`,
        );
        break;
      case 'JOKER_SET':
        console.log(`   🃏 Joker is ${faceLabel(event.face)}`);
        break;
      case 'WALL_EXHAUSTED':
        console.log('   🧱 The wall is spent — walang manalo');
        break;
      default:
        break;
    }
  }
}

function printSettlement(state: GameState): void {
  if (state.phase.name !== 'HAND_OVER') return;
  const settlement = state.phase.settlement;
  console.log('\n────────────────────────────────────────');
  if (settlement.winner === null) {
    console.log('   WALANG MANALO — no winner, nobody pays');
  } else {
    console.log(`   T Ó D A S — ${nameOf(settlement.winner)} wins the hand`);
    console.log('');
    for (const item of settlement.items) {
      console.log(`   ${item.label.padEnd(30)} ${item.value >= 0 ? '+' : ''}${item.value.toFixed(2)}`);
    }
    for (const multiplier of settlement.multipliers) {
      console.log(`   ${multiplier.label.padEnd(30)} ×${multiplier.factor}`);
    }
    console.log(`   ${'─'.repeat(38)}`);
    console.log(`   ${'Total'.padEnd(30)} ${settlement.total.toFixed(2)}`);
    console.log('');
    for (const transfer of settlement.transfers) {
      console.log(`   ${nameOf(transfer.from).padEnd(30)} −${transfer.amount.toFixed(2)}`);
    }
  }
  console.log('');
  console.log(
    '   Chips: ' +
      state.players.map((p) => `${nameOf(p.seat)} ${p.chips.toFixed(2)}`).join('   ·   '),
  );
  console.log('────────────────────────────────────────\n');
}

function playHand(state: GameState, rng: ReturnType<typeof createRng>): GameState {
  console.log(
    `\n═══ Hand ${state.handNumber} · Round ${state.round} · máno is ${nameOf(state.dealerSeat)} ═══`,
  );
  printEvents(state);

  let steps = 0;
  while (!isHandOver(state) && steps++ < 5000) {
    const claimSeats = seatsAwaitingClaimResponse(state);
    const seat = claimSeats.length > 0 ? claimSeats[0] : currentSeat(state);
    if (seat === null) throw new Error(`stuck in ${state.phase.name}`);

    const options = legalActions(state, seat);
    if (options.length === 0) throw new Error(`no legal actions for ${nameOf(seat)}`);

    const view = publicView(state, seat);
    const decision = decide(view, options, seats[seat], rng);
    state = reduce(state, decision.action);

    if (decision.action.type === 'DISCARD') {
      const discarded = state.discards[state.discards.length - 1];
      console.log(
        `${nameOf(seat).padEnd(12)} discards ${tileLabel(discarded.tile).padEnd(4)}` +
          `  (wall ${tilesRemaining(state)})`,
      );
    } else if (decision.action.type !== 'PASS' && decision.action.type !== 'DRAW') {
      console.log(`${nameOf(seat).padEnd(12)} ${describe(decision.action)}`);
    }
    printEvents(state);
  }

  printSettlement(state);
  return state;
}

let state = createGame({ seed });
const rng = createRng(`cli:${seed}`);
console.log(`Báhay — Filipino mahjong · seed "${seed}"`);

for (let hand = 0; hand < handsToPlay; hand++) {
  state = playHand(state, rng);
  if (hand < handsToPlay - 1) state = nextHand(state);
}

console.log('Final standings:');
[...state.players]
  .sort((a, b) => b.chips - a.chips)
  .forEach((player, index) => {
    console.log(`  ${index + 1}. ${nameOf(player.seat).padEnd(12)} ${player.chips.toFixed(2)}`);
  });
