/**
 * The tile, drawn the way a real one is made.
 *
 * A Filipino set is two bonded layers — a bone-white face and a jade back —
 * with the design carved into the face and filled with colour. So each tile is
 * built the same way, in SVG so it stays crisp at every density:
 *
 *   1. the jade back, visible as a band of thickness below the face
 *   2. the ivory face, lit from the top left and falling off to the bottom right
 *   3. a bevel around the face — bright on the lit edges, shadowed on the far ones
 *   4. a soft sheen where the light catches the glaze
 *   5. the carving: every mark is laid down three times — a dark copy up and
 *      left, a bright copy down and right, then the colour — which reads as a
 *      groove cut into the face rather than ink printed on it
 *   6. the rank, in the top left corner like a playing card, so it stays
 *      readable when tiles overlap on the rack
 */

import React, { memo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { Tile } from '@bahay/engine';
import { colors, suitColor, type, type Palette } from '../theme/tokens';
import { useSvgIds } from '../lib/svgId';

type SuitedTileLike = Extract<Tile, { kind: 'suited' }>;

const CHINESE_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

export const FLOWER_GLYPHS: Record<string, string> = {
  east: '東',
  south: '南',
  west: '西',
  north: '北',
  red: '中',
  green: '發',
  white: '白',
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
  plum: '梅',
  orchid: '蘭',
  chrysanthemum: '菊',
  bamboo: '竹',
};

/** Share of the tile's height taken by the visible thickness under the face. */
export const TILE_THICKNESS = 0.13;

/** Traditional dot layouts, as [column, row] on a 3×3 grid. */
const DOT_LAYOUTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [1, 0],
    [1, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
  7: [
    [0, 0],
    [1, 0.5],
    [2, 1],
    [0, 1.6],
    [2, 1.6],
    [0, 2.4],
    [2, 2.4],
  ],
  8: [
    [0, 0],
    [2, 0],
    [0, 0.8],
    [2, 0.8],
    [0, 1.6],
    [2, 1.6],
    [0, 2.4],
    [2, 2.4],
  ],
  9: [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
};

/** Which dots are red in a traditional set; the rest are indigo or jade. */
function dotColor(rank: number, index: number, palette: Palette): string {
  if (rank === 1) return palette.vermilion;
  if (rank === 5 && index === 2) return palette.vermilion;
  if (rank === 3) return [palette.indigo, palette.vermilion, palette.jade][index];
  if (rank === 7) return index === 0 || index === 1 || index === 2 ? palette.jade : palette.vermilion;
  if (rank === 9) return index >= 3 && index <= 5 ? palette.vermilion : palette.indigo;
  if (rank === 6) return index < 2 ? palette.jade : palette.vermilion;
  return index % 2 === 0 ? palette.indigo : palette.jade;
}

/** Which bamboo sticks are red: the centre of the 5, the top of the 7, the middle of the 9. */
function stickIsRed(rank: number, index: number): boolean {
  if (rank === 5) return index === 2;
  if (rank === 7) return index === 0;
  if (rank === 9) return index % 3 === 1;
  return false;
}

type ArtProps = {
  tile: Tile;
  width: number;
  /** Total height, thickness included. */
  height: number;
  palette?: Palette;
  /** Thicker carving for the high-contrast path. */
  bold?: boolean;
  /** Draw the back instead of the face. */
  faceDown?: boolean;
  /** A brass edge, for the selected tile. */
  highlight?: boolean;
};

/**
 * One tile, face or back. Pure and memoised: a table can hold a couple of
 * hundred of these, and a tile that has not changed should not redraw.
 */
export const TileArt = memo(function TileArt({
  tile,
  width,
  height,
  palette = colors,
  bold = false,
  faceDown = false,
  highlight = false,
}: ArtProps) {
  const W = width;
  const H = height;
  const T = Math.max(2, Math.round(H * TILE_THICKNESS));
  const F = H - T; // the face
  const r = Math.max(2, W * 0.14);
  const id = useSvgIds();
  const compact = W < 26;

  return (
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={id('back')} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.tileBackLight} />
            <Stop offset="0.55" stopColor={palette.tileBack} />
            <Stop offset="1" stopColor={palette.tileBackDark} />
          </LinearGradient>
          <LinearGradient id={id('side')} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.tileEdge} />
            <Stop offset="1" stopColor={palette.tileShadow} />
          </LinearGradient>
          <LinearGradient id={id('face')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFEF9" />
            <Stop offset="0.55" stopColor={palette.tileFace} />
            <Stop offset="1" stopColor="#ECE2CB" />
          </LinearGradient>
          <LinearGradient id={id('bevel')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.15" />
            <Stop offset="1" stopColor={palette.tileShadow} stopOpacity="0.9" />
          </LinearGradient>
          <RadialGradient id={id('sheen')} cx="22%" cy="12%" rx="70%" ry="55%" fx="22%" fy="12%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.7" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={id('jade')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.tileBackLight} />
            <Stop offset="0.5" stopColor={palette.tileBack} />
            <Stop offset="1" stopColor={palette.tileBackDark} />
          </LinearGradient>
        </Defs>

        {/* The body: a jade slab with an ivory layer bonded on top. */}
        <Rect x={0} y={0} width={W} height={H} rx={r} fill={`url(#${id('back')})`} />
        <Rect
          x={0}
          y={0}
          width={W}
          height={F + T * 0.42}
          rx={r}
          fill={faceDown ? `url(#${id('back')})` : `url(#${id('side')})`}
        />

        {faceDown ? (
          <>
            <Rect x={0} y={0} width={W} height={F} rx={r} fill={`url(#${id('jade')})`} />
            <Rect
              x={0.8}
              y={0.8}
              width={W - 1.6}
              height={F - 1.6}
              rx={r - 0.8}
              fill="none"
              stroke={`url(#${id('bevel')})`}
              strokeOpacity={0.55}
              strokeWidth={1.2}
            />
            <Rect x={0} y={0} width={W} height={F} rx={r} fill={`url(#${id('sheen')})`} opacity={0.45} />
          </>
        ) : (
          <>
            <Rect x={0} y={0} width={W} height={F} rx={r} fill={`url(#${id('face')})`} />
            <Rect
              x={0.7}
              y={0.7}
              width={W - 1.4}
              height={F - 1.4}
              rx={r - 0.7}
              fill="none"
              stroke={`url(#${id('bevel')})`}
              strokeWidth={Math.max(1, W * 0.04)}
            />
            {tile.kind === 'suited' ? (
              <SuitedArt tile={tile} W={W} F={F} compact={compact} palette={palette} bold={bold} />
            ) : null}
            <Rect x={0} y={0} width={W} height={F} rx={r} fill={`url(#${id('sheen')})`} opacity={0.5} />
          </>
        )}

        {highlight ? (
          <Rect
            x={0.75}
            y={0.75}
            width={W - 1.5}
            height={H - 1.5}
            rx={r}
            fill="none"
            stroke={palette.gold}
            strokeWidth={1.5}
          />
        ) : null}
      </Svg>

      {/* Type sits above the SVG so it uses the app's own fonts everywhere. */}
      {faceDown ? null : tile.kind === 'flower' ? (
        <FlowerGlyph tile={tile} W={W} F={F} palette={palette} bold={bold} />
      ) : (
        <SuitedType tile={tile} W={W} F={F} compact={compact} palette={palette} bold={bold} />
      )}
    </View>
  );
});

/** Where the carving goes, below the corner index. */
function artBox(W: number, F: number, compact: boolean) {
  const m = W * 0.11;
  const index = cornerSize(W, compact);
  const top = compact ? F * 0.46 : m + index * 0.78;
  const left = compact ? W * 0.32 : m;
  return { x: left, y: top, w: W - left - m, h: F - top - m * 0.9 };
}

function cornerSize(W: number, compact: boolean): number {
  return compact ? Math.max(8, W * 0.62) : Math.max(9, W * 0.4);
}

/**
 * Carve a mark: dark shadow up-left, bright highlight down-right, then the
 * colour. `children` renders the shape given a fill colour.
 */
function Carve({
  depth,
  children,
}: {
  depth: number;
  children: (fill: string, opacity: number) => React.ReactNode;
}) {
  return (
    <>
      <G transform={`translate(${-depth * 0.7}, ${-depth * 0.7})`}>{children('#4A3A28', 0.28)}</G>
      <G transform={`translate(${depth}, ${depth})`}>{children('#FFFFFF', 0.9)}</G>
      <G>{children('', 1)}</G>
    </>
  );
}

function SuitedArt({
  tile,
  W,
  F,
  compact,
  palette,
  bold,
}: {
  tile: SuitedTileLike;
  W: number;
  F: number;
  compact: boolean;
  palette: Palette;
  bold: boolean;
}) {
  if (tile.suit === 'chars') return null; // characters are type, drawn above
  const box = artBox(W, F, compact);
  const depth = Math.max(0.4, W * 0.018);

  if (tile.suit === 'balls') {
    const layout = DOT_LAYOUTS[tile.rank];
    const maxRow = Math.max(...layout.map(([, row]) => row));
    const big = tile.rank === 1;
    const cell = Math.min(box.w / 3, box.h / (maxRow + 1));
    const radius = big ? Math.min(box.w, box.h) * 0.46 : cell * 0.44;
    const position = (col: number, row: number) =>
      big
        ? { cx: box.x + box.w / 2, cy: box.y + box.h / 2 }
        : {
            cx: box.x + cell / 2 + (box.w - cell) * (col / 2),
            cy:
              maxRow === 0
                ? box.y + box.h / 2
                : box.y + cell / 2 + (box.h - cell) * (row / maxRow),
          };
    return (
      <Carve depth={depth}>
        {(fill, opacity) =>
          layout.map(([col, row], index) => {
            const { cx, cy } = position(col, row);
            const tone = fill || dotColor(tile.rank, index, palette);
            const stroke = Math.max(0.6, radius * (bold ? 0.3 : 0.22));
            return (
              <G key={index} opacity={opacity}>
                <Circle cx={cx} cy={cy} r={radius - stroke / 2} fill="none" stroke={tone} strokeWidth={stroke} />
                <Circle cx={cx} cy={cy} r={radius * 0.38} fill={tone} />
                {big ? (
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={radius * 0.68}
                    fill="none"
                    stroke={fill || palette.jade}
                    strokeWidth={stroke * 0.7}
                  />
                ) : null}
              </G>
            );
          })
        }
      </Carve>
    );
  }

  // Kahoy — bamboo stalks with a node across the middle and caps at the ends.
  const count = tile.rank;
  const columns = count === 1 ? 1 : count <= 4 ? 2 : 3;
  const rowsN = Math.ceil(count / columns);
  const cellW = box.w / columns;
  const cellH = box.h / rowsN;
  const stalkW = Math.max(1.6, Math.min(cellW * 0.42, W * 0.12) * (count === 1 ? 1.5 : 1));
  const stalkH = cellH * (count === 1 ? 0.92 : 0.84);
  return (
    <Carve depth={depth}>
      {(fill, opacity) =>
        Array.from({ length: count }).map((_, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          // A lone stick on a short last row is centred under the others.
          const inRow = row === rowsN - 1 ? count - row * columns : columns;
          const offset = ((columns - inRow) * cellW) / 2;
          const cx = box.x + offset + cellW * (col + 0.5);
          const cy = box.y + cellH * (row + 0.5);
          const tone = fill || (stickIsRed(count, index) ? palette.vermilion : palette.jade);
          const node = Math.max(0.6, stalkH * 0.09);
          return (
            <G key={index} opacity={opacity}>
              <Rect
                x={cx - stalkW / 2}
                y={cy - stalkH / 2}
                width={stalkW}
                height={stalkH}
                rx={stalkW / 2}
                fill={tone}
              />
              {fill ? null : (
                <>
                  <Rect
                    x={cx - stalkW / 2 - 0.3}
                    y={cy - node / 2}
                    width={stalkW + 0.6}
                    height={node}
                    fill={palette.tileFace}
                    opacity={0.75}
                  />
                  <Rect
                    x={cx - stalkW * 0.12}
                    y={cy - stalkH / 2 + stalkH * 0.12}
                    width={stalkW * 0.24}
                    height={stalkH * 0.76}
                    rx={stalkW * 0.12}
                    fill={palette.tileFace}
                    opacity={0.35}
                  />
                </>
              )}
            </G>
          );
        })
      }
    </Carve>
  );
}

/** Text carved the same way: a dark lip above, a bright one below. */
function carvedText(size: number) {
  const d = Math.max(0.5, size * 0.05);
  return {
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowOffset: { width: d, height: d },
    textShadowRadius: Platform.OS === 'web' ? 0.01 : 0,
  };
}

function SuitedType({
  tile,
  W,
  F,
  compact,
  palette,
  bold,
}: {
  tile: SuitedTileLike;
  W: number;
  F: number;
  compact: boolean;
  palette: Palette;
  bold: boolean;
}) {
  const tone = suitColor(tile.suit, palette);
  const index = cornerSize(W, compact);
  const m = W * 0.11;
  const box = artBox(W, F, compact);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* The corner index — the rank as a numeral, like a playing card. */}
      <Text
        allowFontScaling={false}
        style={[
          styles.index,
          carvedText(index),
          {
            left: compact ? m * 0.7 : m * 0.9,
            top: compact ? m * 0.2 : m * 0.35,
            fontSize: index,
            lineHeight: index * 1.02,
            color: tone,
            fontFamily: type.display,
          },
        ]}
      >
        {tile.rank}
      </Text>

      {tile.suit === 'chars' ? (
        <View
          style={{
            position: 'absolute',
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {compact ? (
            <Text
              allowFontScaling={false}
              style={[
                carvedText(box.h * 0.6),
                {
                  fontSize: Math.min(box.w, box.h) * 0.95,
                  lineHeight: Math.min(box.w, box.h),
                  color: palette.vermilion,
                  fontWeight: bold ? '800' : '700',
                },
              ]}
            >
              萬
            </Text>
          ) : (
            <>
              <Text
                allowFontScaling={false}
                style={[
                  carvedText(box.h * 0.4),
                  {
                    fontSize: Math.min(box.w * 0.82, box.h * 0.44),
                    lineHeight: Math.min(box.w * 0.82, box.h * 0.44) * 1.05,
                    color: palette.indigo,
                    fontWeight: bold ? '800' : '700',
                  },
                ]}
              >
                {CHINESE_NUMERALS[tile.rank - 1]}
              </Text>
              <Text
                allowFontScaling={false}
                style={[
                  carvedText(box.h * 0.4),
                  {
                    fontSize: Math.min(box.w * 0.82, box.h * 0.46),
                    lineHeight: Math.min(box.w * 0.82, box.h * 0.46) * 1.05,
                    color: palette.vermilion,
                    fontWeight: bold ? '800' : '700',
                  },
                ]}
              >
                萬
              </Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Flowers — winds, dragons and seasons alike — are bonus tiles that never build
 * a hand, so they are carved lighter than the suits.
 */
function FlowerGlyph({
  tile,
  W,
  F,
  palette,
  bold,
}: {
  tile: Extract<Tile, { kind: 'flower' }>;
  W: number;
  F: number;
  palette: Palette;
  bold: boolean;
}) {
  const glyph = FLOWER_GLYPHS[tile.face] ?? '花';
  const tone =
    tile.face === 'red' ? palette.vermilion : tile.face === 'green' ? palette.jade : palette.inkSoft;
  const size = Math.min(W * 0.72, F * 0.56);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height: F, alignItems: 'center', justifyContent: 'center' }]}>
      <Text
        allowFontScaling={false}
        style={[
          carvedText(size),
          { fontSize: size, lineHeight: size * 1.1, color: tone, opacity: bold ? 1 : 0.85, fontWeight: '600' },
        ]}
      >
        {glyph}
      </Text>
    </View>
  );
}

/**
 * A tile standing on its edge, seen from straight above — what you see of the
 * hidden hands across the table: a sliver of ivory facing its owner and jade
 * facing you. `along` is the length of the row's direction; `depth` is how far
 * the sliver reaches toward the table's centre.
 */
export const StandingTile = memo(function StandingTile({
  along,
  depth,
  facing,
  palette = colors,
}: {
  along: number;
  depth: number;
  /** Which way the ivory face points, from the owner's side. */
  facing: 'down' | 'up' | 'left' | 'right';
  palette?: Palette;
}) {
  const horizontal = facing === 'up' || facing === 'down';
  const w = horizontal ? along : depth;
  const h = horizontal ? depth : along;
  const ivoryFirst = facing === 'up' || facing === 'left';
  const split = 0.45;
  const ivory = {
    backgroundColor: palette.tileFace,
    flex: split,
  };
  const jade = { backgroundColor: palette.tileBack, flex: 1 - split };
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: Math.max(1.5, Math.min(w, h) * 0.3),
        overflow: 'hidden',
        flexDirection: horizontal ? 'column' : 'row',
        borderWidth: 0.5,
        borderColor: 'rgba(0,0,0,0.35)',
      }}
    >
      <View style={ivoryFirst ? ivory : jade} />
      <View style={ivoryFirst ? jade : ivory} />
    </View>
  );
});

/**
 * A compact label — rank and a suit mark — for places where even a small tile
 * would crowd the layout, like the settlement's itemised lines.
 */
export function TileGlyph({ tile, size, palette = colors }: { tile: Tile; size: number; palette?: Palette }) {
  if (tile.kind === 'flower') {
    return (
      <Text style={{ fontSize: size * 0.62, color: palette.inkSoft, opacity: 0.8 }}>
        {FLOWER_GLYPHS[tile.face] ?? '花'}
      </Text>
    );
  }
  const tone = suitColor(tile.suit, palette);
  return (
    <Text
      style={{
        fontFamily: type.display,
        fontSize: size * 0.95,
        lineHeight: size * 1.05,
        color: tone,
      }}
    >
      {tile.rank}
    </Text>
  );
}

const styles = StyleSheet.create({
  index: {
    position: 'absolute',
    includeFontPadding: false,
  },
});
