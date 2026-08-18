/**
 * The filtered view of the table.
 *
 * The AI must never see concealed hands or the wall order — it is given a
 * PublicGameView, not a GameState, and the type system enforces it. The same
 * shape is what a server would broadcast to a client in Phase 4.
 */

import { countFace } from './hand.js';
import { allFaces } from './hand.js';
import { isSuited } from './tiles.js';
import { wallRemaining } from './wall.js';
import type {
  Face,
  FlowerTile,
  GamePhase,
  GameState,
  Meld,
  Ruleset,
  SeatId,
  Tile,
} from './types.js';

export type PublicPlayerView = {
  seat: SeatId;
  concealedCount: number;
  melds: Meld[];
  flowers: FlowerTile[];
  isDealer: boolean;
  chips: number;
};

export type PublicGameView = {
  seat: SeatId;
  hand: Tile[];
  melds: Meld[];
  flowers: FlowerTile[];
  players: PublicPlayerView[];
  discards: { tile: Tile; from: SeatId; claimed: boolean }[];
  joker: Face | null;
  ruleset: Ruleset;
  phase: GamePhase;
  tilesRemaining: number;
  dealerSeat: SeatId;
  round: number;
  handNumber: number;
  doublesActive: boolean;
  /** Jai alái markers per seat, and the pot. Public at any real table. */
  markers: [number, number, number, number];
  pot: number;
};

/**
 * The phase carries tiles that belong to one seat: the tile the player to act
 * just drew, and the concealed tiles a claimer has committed to a call. Those
 * must not travel to anyone else — a client that can read the wall draw as it
 * happens can read the whole table.
 */
function redactPhase(phase: GameState['phase'], seat: SeatId): GameState['phase'] {
  if (phase.name === 'AWAITING_DISCARD') {
    return phase.seat === seat ? phase : { ...phase, justDrew: null };
  }
  if (phase.name === 'PENDING_CLAIMS') {
    return {
      ...phase,
      claims: phase.claims.map((claim) =>
        claim.seat === seat ? claim : { ...claim, tileIds: [] },
      ),
    };
  }
  return phase;
}

export function publicView(state: GameState, seat: SeatId): PublicGameView {
  const me = state.players[seat];
  return {
    seat,
    hand: [...me.concealed],
    melds: me.melds,
    flowers: me.flowers,
    players: state.players.map((p) => ({
      seat: p.seat,
      concealedCount: p.concealed.length,
      melds: p.melds,
      flowers: p.flowers,
      isDealer: p.isDealer,
      chips: p.chips,
    })),
    discards: state.discards,
    joker: state.joker,
    ruleset: state.ruleset,
    phase: redactPhase(state.phase, seat),
    tilesRemaining: wallRemaining(state),
    dealerSeat: state.dealerSeat,
    round: state.round,
    handNumber: state.handNumber,
    doublesActive: state.doublesActive,
    markers: [...state.markers] as [number, number, number, number],
    pot: state.pot,
  };
}

/**
 * How many copies of a face nobody at the table has seen — the single highest
 * value piece of information in mahjong, and almost no app surfaces it.
 */
export function unseenCount(view: PublicGameView, face: Face): number {
  let seen = 0;
  seen += countFace(view.hand, face);
  for (const player of view.players) {
    for (const meld of player.melds) {
      // A secret kang is face-down and only its owner knows it, but once it is
      // declared the whole table has seen the tiles.
      seen += meld.tiles.filter(
        (t) => isSuited(t) && t.suit === face.suit && t.rank === face.rank,
      ).length;
    }
  }
  for (const discard of view.discards) {
    if (isSuited(discard.tile) && discard.tile.suit === face.suit && discard.tile.rank === face.rank) {
      seen++;
    }
  }
  return Math.max(0, 4 - seen);
}

export function unseenCounts(view: PublicGameView): Map<string, number> {
  const map = new Map<string, number>();
  for (const face of allFaces()) {
    map.set(`${face.suit}-${face.rank}`, unseenCount(view, face));
  }
  return map;
}
