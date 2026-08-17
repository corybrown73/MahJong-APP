import type { Face, FlowerTile, Rank, Suit, SuitedTile, Tile } from './types.js';

export const SUITS: Suit[] = ['balls', 'sticks', 'chars'];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Filipino names for the three playable suits. */
export const SUIT_LABELS: Record<Suit, string> = {
  balls: 'bolá',
  sticks: 'kahoy',
  chars: 'letra',
};

export const WIND_FACES = ['east', 'south', 'west', 'north'] as const;
export const DRAGON_FACES = ['red', 'green', 'white'] as const;
export const SEASON_FACES = [
  'spring',
  'summer',
  'autumn',
  'winter',
  'plum',
  'orchid',
  'chrysanthemum',
  'bamboo',
] as const;

export function isSuited(tile: Tile): tile is SuitedTile {
  return tile.kind === 'suited';
}

export function isFlower(tile: Tile): tile is FlowerTile {
  return tile.kind === 'flower';
}

export function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

/** Index into the 27-slot count vector used by the hand solver. */
export function faceIndex(suit: Suit, rank: Rank): number {
  return suitIndex(suit) * 9 + (rank - 1);
}

export function faceFromIndex(index: number): Face {
  return { suit: SUITS[Math.floor(index / 9)], rank: ((index % 9) + 1) as Rank };
}

export function sameFace(a: Face, b: Face): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function tileFace(tile: SuitedTile): Face {
  return { suit: tile.suit, rank: tile.rank };
}

export function tileMatchesFace(tile: Tile, face: Face): boolean {
  return tile.kind === 'suited' && tile.suit === face.suit && tile.rank === face.rank;
}

export function faceKey(face: Face): string {
  return `${face.suit}-${face.rank}`;
}

/**
 * The full 144-tile set: 108 suited tiles (the only tiles that build hands)
 * plus 36 flowers (winds, dragons, seasons — bonus tiles in Filipino play).
 * Order is fixed and deterministic; the wall is shuffled afterwards.
 */
export function buildTileSet(): Tile[] {
  const tiles: Tile[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({ kind: 'suited', suit, rank, id: `${suit}-${rank}-c${copy}` });
      }
    }
  }
  for (const face of WIND_FACES) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ kind: 'flower', group: 'wind', face, id: `wind-${face}-c${copy}` });
    }
  }
  for (const face of DRAGON_FACES) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ kind: 'flower', group: 'dragon', face, id: `dragon-${face}-c${copy}` });
    }
  }
  for (const face of SEASON_FACES) {
    tiles.push({ kind: 'flower', group: 'season', face, id: `season-${face}-c0` });
  }
  return tiles;
}

/** Sort key used by the rack's optional auto-sort: suit, then rank, then id. */
export function tileSortKey(tile: Tile): string {
  if (tile.kind === 'suited') {
    return `${suitIndex(tile.suit)}-${tile.rank}-${tile.id}`;
  }
  return `9-${tile.group}-${tile.face}`;
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => (tileSortKey(a) < tileSortKey(b) ? -1 : 1));
}

/** Human-readable, used by the CLI harness and debug output. */
export function tileLabel(tile: Tile): string {
  if (tile.kind === 'suited') return `${tile.rank}${SUIT_LABELS[tile.suit][0].toUpperCase()}`;
  return tile.face.slice(0, 2).toUpperCase();
}

export function faceLabel(face: Face): string {
  return `${face.rank} ${SUIT_LABELS[face.suit]}`;
}
