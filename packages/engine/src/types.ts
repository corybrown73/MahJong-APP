/**
 * Báhay — core data model.
 *
 * Turn order is 0 -> 1 -> 2 -> 3 -> 0 (counterclockwise at a real table).
 * Screen mapping (the human player sits at the bottom):
 *   seat 0 = bottom (you)   seat 1 = RIGHT edge (plays after you)
 *   seat 2 = top            seat 3 = LEFT edge  (plays before you)
 * Therefore seat N may chow only from seat (N + 3) % 4.
 */

export type Suit = 'balls' | 'sticks' | 'chars';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type FlowerGroup = 'wind' | 'dragon' | 'season';

export type SuitedTile = { kind: 'suited'; suit: Suit; rank: Rank; id: string };
export type FlowerTile = { kind: 'flower'; group: FlowerGroup; face: string; id: string };
export type Tile = SuitedTile | FlowerTile;

/** A suit+rank pair with no identity — "the 5 of balls" rather than "this 5 of balls". */
export type Face = { suit: Suit; rank: Rank };

export type SeatId = 0 | 1 | 2 | 3;

export type Meld =
  | { type: 'chow'; tiles: [Tile, Tile, Tile]; claimedFrom: SeatId }
  | { type: 'pung'; tiles: [Tile, Tile, Tile]; claimedFrom: SeatId | null }
  | {
      type: 'kang';
      tiles: [Tile, Tile, Tile, Tile];
      variant: 'open' | 'secret' | 'sagasa';
      claimedFrom: SeatId | null;
    };

export type PlayerState = {
  seat: SeatId;
  /** The rack, in the player's chosen order. The engine never reorders it. */
  concealed: Tile[];
  melds: Meld[];
  flowers: FlowerTile[];
  isDealer: boolean;
  chips: number;
  /** True until the player draws or is dealt their first flower. Drives the No Flowers ambition. */
  everDrewFlower: boolean;
};

export type CallType = 'chow' | 'pung' | 'kang' | 'todas';

export type Claim = { seat: SeatId; call: CallType; tileIds: string[] };

export type GamePhase =
  | { name: 'DEALING' }
  | { name: 'AWAITING_DRAW'; seat: SeatId }
  | { name: 'AWAITING_DISCARD'; seat: SeatId; justDrew: Tile | null }
  | {
      name: 'PENDING_CLAIMS';
      discard: Tile;
      from: SeatId;
      eligible: SeatId[];
      claims: Claim[];
      passed: SeatId[];
      /**
       * Set when this window exists because a player declared sagása and the
       * ruleset allows robbing the kang. Only 'todas' claims are collected; if
       * everyone passes, the pending kang completes.
       */
      robbingKang?: { seat: SeatId; face: Face };
    }
  | { name: 'HAND_OVER'; settlement: Settlement };

export type AmbitionId =
  // base
  | 'todas'
  | 'bunot'
  // hand structure
  | 'escalera'
  | 'sietePares'
  | 'fullFlush'
  | 'allPungs'
  | 'allChows'
  | 'concealedHand'
  | 'allRevealed'
  | 'quickWin'
  | 'paningit'
  | 'singleWait'
  | 'backToBack'
  | 'bisaklat'
  // immediate
  | 'openKang'
  | 'secretKang'
  | 'sagasa'
  | 'noFlowers'
  | 'thirteenFlowers';

export type SettlementItem = { ambition: AmbitionId; label: string; value: number };
export type Transfer = { from: SeatId; to: SeatId; amount: number };

export type Settlement = {
  winner: SeatId | null;
  winType: 'discard' | 'bunot' | 'bisaklat' | 'draw';
  discarder: SeatId | null;
  items: SettlementItem[];
  multipliers: { label: string; factor: number }[];
  total: number;
  transfers: Transfer[];
  /** Immediate ambitions already settled during the hand, for the win screen. */
  immediate: ImmediatePayout[];
  /** Jai alái: markers earned this hand, when the pot is being played. */
  markerAward?: { seat: SeatId; markers: number; reason: string };
  /** Jai alái: set when this hand's markers reached the target and took the pot. */
  potWin?: { seat: SeatId; amount: number };
};

export type ImmediatePayout = {
  ambition: AmbitionId;
  label: string;
  seat: SeatId;
  value: number;
  /** Total collected from the other three players. */
  amount: number;
};

/**
 * The jai alái — the marker pot played as a session layer above the hands.
 * Everyone antes into the pot; hand winners earn markers (talbog 1, búnot 2,
 * bisaklát 2, +1 when the hand carried an ambition); first to `markersToWin`
 * sweeps the pot. Ten markers instead of five is the kalembang variant.
 */
export type JaiAlaiRules = {
  enabled: boolean;
  ante: number;
  markersToWin: number;
  markerAwards: {
    win: number;
    bunot: number;
    bisaklat: number;
    /** Extra marker(s) when the winning hand carried a major ambition. */
    ambitionBonus: number;
  };
  /**
   * The "majors" — the ambitions this table counts for the bonus marker.
   * A plain win earns `win` markers; a win carrying any of these earns
   * `win + ambitionBonus` (so with the defaults, a major pays 2).
   */
  majors: AmbitionId[];
};

export type Ruleset = {
  id: string;
  label: string;
  jokerEnabled: boolean;
  doublesOnDoubleRoll: boolean;
  robbingTheKang: boolean;
  /** Standard Filipino play: chow only from the player before you. */
  chowFromAnyPlayer: boolean;
  multipleWinnersOnDiscard: boolean;
  sieteParesRequiresConcealed: boolean;
  quickWinDiscardLimit: number;
  bisaklatValue: number;
  drawEndsDealership: boolean;
  roundsPerGame: number;
  /** How many flowers pay the thirteen-flowers bonus. 0 disables it (Visayan). */
  thirteenFlowersThreshold: number;
  /** Bisaklát Escaléra / Bisaklát Siete Pares: dealt-hand ambitions stack on top. */
  bisaklatStacksAmbitions: boolean;
  jaiAlai: JaiAlaiRules;
  ambitionValues: Record<AmbitionId, number>;
};

export type Action =
  | { type: 'DRAW'; seat: SeatId }
  | { type: 'DISCARD'; seat: SeatId; tileId: string }
  | { type: 'CLAIM'; seat: SeatId; call: CallType; tileIds: string[] }
  | { type: 'PASS'; seat: SeatId }
  | { type: 'SECRET_KANG'; seat: SeatId; suit: Suit; rank: Rank }
  | { type: 'SAGASA'; seat: SeatId; suit: Suit; rank: Rank }
  | { type: 'DECLARE_TODAS'; seat: SeatId };

/**
 * Events describe what just happened, for the UI to announce and animate.
 * `state.events` holds only the events produced by the most recent action.
 */
export type GameEvent =
  | { type: 'DEALT' }
  | { type: 'FLOWER'; seat: SeatId; tile: FlowerTile; replacement: Tile }
  | { type: 'DREW'; seat: SeatId; tile: Tile | null; fromGiftWall: boolean }
  | { type: 'DISCARDED'; seat: SeatId; tile: Tile }
  | { type: 'CALLED'; seat: SeatId; call: CallType; tile: Tile; from: SeatId | null }
  | { type: 'KANG_DECLARED'; seat: SeatId; variant: 'open' | 'secret' | 'sagasa'; face: Face }
  | { type: 'IMMEDIATE_PAYOUT'; payout: ImmediatePayout }
  | { type: 'JOKER_SET'; face: Face }
  | { type: 'WALL_EXHAUSTED' }
  | { type: 'HAND_OVER'; settlement: Settlement };

export type GameState = {
  seed: string;
  ruleset: Ruleset;
  /** All 144 tiles as a circular array. `breakIndex` is where the wall was broken. */
  wall: Tile[];
  breakIndex: number;
  /** Next tile to draw; moves forward, modulo 144. */
  drawIndex: number;
  /** Next gift/replacement tile; moves backward, modulo 144. */
  flowerIndex: number;
  drawnFromWall: number;
  giftsDrawn: number;
  dice: [number, number];
  joker: Face | null;
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  discards: { tile: Tile; from: SeatId; claimed: boolean }[];
  phase: GamePhase;
  round: number;
  handNumber: number;
  dealerSeat: SeatId;
  doublesActive: boolean;
  /** Jai alái markers per seat, carried across hands. All zeros when disabled. */
  markers: [number, number, number, number];
  /** The jai alái pot. Anted at session start, re-anted after a pot is won. */
  pot: number;
  /** Immediate ambitions paid so far this hand. */
  immediate: ImmediatePayout[];
  /** Full action log — replays, and undo in the tutorial. */
  history: Action[];
  /** Events produced by the most recent action only. */
  events: GameEvent[];
  /** Pending sagása awaiting a robbing-the-kang window. */
  pendingKang: { seat: SeatId; face: Face } | null;
};
