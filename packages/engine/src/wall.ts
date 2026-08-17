/**
 * The wall.
 *
 * Filipino play has no fixed-size dead wall. The wall is one circular array of
 * all 144 tiles with a break point B: the draw pointer starts at B and moves
 * forward; the flower ("gift") pointer starts at B − 1 and moves backward. The
 * two converge, and that convergence is the *single* wall-exhaustion event.
 */

import { createRng, shuffle } from './rng.js';
import { buildTileSet } from './tiles.js';
import type { SeatId, Tile } from './types.js';

export const WALL_SIZE = 144;
export const TILES_PER_WALL = 36;

export function buildWall(seed: string): Tile[] {
  return shuffle(buildTileSet(), createRng(`${seed}:wall`));
}

/**
 * The máno rolls two dice. The sum counts walls counterclockwise from the
 * dealer to pick a wall, then counts that many stacks along it. Each stack is
 * two tiles, so the break lands `sum × 2` tiles into the chosen wall.
 */
export function breakPoint(dealerSeat: SeatId, dice: [number, number]): number {
  const sum = dice[0] + dice[1];
  const wallIndex = (dealerSeat + sum - 1) % 4;
  return (wallIndex * TILES_PER_WALL + sum * 2) % WALL_SIZE;
}

export function rollDice(seed: string, handNumber: number): [number, number] {
  const rng = createRng(`${seed}:dice:${handNumber}`);
  return [rng.die(), rng.die()];
}

export function isDoubles(dice: [number, number]): boolean {
  return dice[0] === dice[1];
}

export type WallPointers = {
  wall: Tile[];
  drawIndex: number;
  flowerIndex: number;
  drawnFromWall: number;
  giftsDrawn: number;
};

export function wallRemaining(p: Pick<WallPointers, 'drawnFromWall' | 'giftsDrawn'>): number {
  return WALL_SIZE - p.drawnFromWall - p.giftsDrawn;
}

export function wallExhausted(p: Pick<WallPointers, 'drawnFromWall' | 'giftsDrawn'>): boolean {
  return wallRemaining(p) <= 0;
}

/** Take the next tile from the draw wall. Mutates the pointer bundle. */
export function takeFromDrawWall(p: WallPointers): Tile | null {
  if (wallExhausted(p)) return null;
  const tile = p.wall[p.drawIndex];
  p.drawIndex = (p.drawIndex + 1) % WALL_SIZE;
  p.drawnFromWall++;
  return tile;
}

/** Take the next gift/replacement tile from the flower wall. Mutates. */
export function takeFromFlowerWall(p: WallPointers): Tile | null {
  if (wallExhausted(p)) return null;
  const tile = p.wall[p.flowerIndex];
  p.flowerIndex = (p.flowerIndex - 1 + WALL_SIZE) % WALL_SIZE;
  p.giftsDrawn++;
  return tile;
}
