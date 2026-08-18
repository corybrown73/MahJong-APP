/**
 * Tile faces, drawn as SVG so they stay crisp at every density.
 *
 * The three playable suits carry the only saturated colour on screen, so a
 * tile's suit reads instantly even at rack size. Flowers — which in Filipino
 * play are winds, dragons and seasons all together, and never build a hand —
 * are rendered thinner and softer. That visual demotion teaches the ruleset
 * without a word of text.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import type { Tile } from '@bahay/engine';
import { colors, suitColor, type, type Palette } from '../theme/tokens';

type SuitedTileLike = Extract<Tile, { kind: 'suited' }>;

const CHINESE_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

const FLOWER_GLYPHS: Record<string, string> = {
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

/** Traditional dot layouts, as [column, row] pairs on a 3×3 grid. */
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
    [1, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  8: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
    [1, 0],
    [1, 2],
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

/** Bolá alternate vermilion and indigo in the traditional layout. */
function dotColor(rank: number, index: number, palette: Palette): string {
  if (rank === 1) return palette.vermilion;
  return index % 2 === 0 ? palette.indigo : palette.vermilion;
}

type FaceProps = {
  tile: Tile;
  width: number;
  height: number;
  palette?: Palette;
  /** Thicker strokes for the high-contrast path. */
  bold?: boolean;
};

/**
 * Share of the tile's height given to the rank. Tiles overlap on the rack, so
 * the numeral lives at the top left — the sliver that always stays visible.
 */
const INDEX_STRIP = 0.3;

/**
 * The suit, as a shape rather than a word: a circle for bolá, a stalk for
 * kahoy, a block for letra. Shape plus colour means the suit still reads on a
 * colourblind path, and it survives being drawn at eight pixels.
 */
function SuitMark({
  suit,
  size,
  color,
  bold,
}: {
  suit: 'balls' | 'sticks' | 'chars';
  size: number;
  color: string;
  bold?: boolean;
}) {
  if (suit === 'balls') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(1, size * (bold ? 0.26 : 0.2)),
          borderColor: color,
        }}
      />
    );
  }
  if (suit === 'sticks') {
    return (
      <View
        style={{
          width: Math.max(2, size * 0.38),
          height: size,
          borderRadius: size * 0.2,
          backgroundColor: color,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size * 0.88,
        height: size * 0.88,
        borderRadius: 1.5,
        backgroundColor: color,
      }}
    />
  );
}

export function TileFace({ tile, width, height, palette = colors, bold = false }: FaceProps) {
  if (tile.kind === 'flower') {
    const glyph = FLOWER_GLYPHS[tile.face] ?? '花';
    const tone =
      tile.face === 'red' ? palette.vermilion : tile.face === 'green' ? palette.jade : palette.inkSoft;
    return (
      <View style={styles.center}>
        <Text
          style={{
            fontSize: height * 0.42,
            color: tone,
            opacity: bold ? 0.95 : 0.78,
            fontWeight: bold ? '600' : '400',
            includeFontPadding: false,
          }}
        >
          {glyph}
        </Text>
      </View>
    );
  }

  // Every suited tile carries its rank as a numeral. Counting six dots or
  // reading 五 is a skill; the number is not, and beginners should not have to
  // learn one to play the other.
  const tone = suitColor(tile.suit, palette);
  const stripHeight = Math.max(10, height * INDEX_STRIP);
  const artHeight = height - stripHeight;
  const gutter = Math.max(2, width * 0.1);

  return (
    <View style={{ width, height }}>
      <View style={[styles.indexRow, { height: stripHeight, paddingLeft: gutter }]}>
        <Text
          style={{
            fontFamily: type.display,
            fontSize: stripHeight * 0.92,
            lineHeight: stripHeight,
            color: tone,
            includeFontPadding: false,
          }}
        >
          {tile.rank}
        </Text>
      </View>
      <View style={{ width, height: artHeight, alignItems: 'center', justifyContent: 'center' }}>
        {suitedArt(tile, width, artHeight, palette, bold)}
      </View>
    </View>
  );
}

/** The traditional face: dots, stalks, or the character and 萬. */
function suitedArt(
  tile: SuitedTileLike,
  width: number,
  height: number,
  palette: Palette,
  bold: boolean,
) {
  if (tile.suit === 'chars') {
    return (
      <View style={styles.center}>
        <Text
          style={{
            fontSize: height * 0.3,
            lineHeight: height * 0.32,
            color: palette.indigo,
            fontWeight: '600',
            includeFontPadding: false,
          }}
        >
          {CHINESE_NUMERALS[tile.rank - 1]}
        </Text>
        <Text
          style={{
            fontSize: height * 0.28,
            lineHeight: height * 0.3,
            color: palette.vermilion,
            fontWeight: '600',
            includeFontPadding: false,
          }}
        >
          萬
        </Text>
      </View>
    );
  }

  const inset = width * 0.16;
  const boxW = width - inset * 2;
  const boxH = height - inset * 2;

  if (tile.suit === 'balls') {
    const layout = DOT_LAYOUTS[tile.rank];
    const cell = Math.min(boxW / 3, boxH / 3);
    const r = tile.rank === 1 ? cell * 0.85 : cell * 0.4;
    return (
      <Svg width={width} height={height}>
        <G>
          {layout.map(([col, row], index) => (
            <Circle
              key={`${col}-${row}-${index}`}
              cx={inset + boxW / 2 + (col - 1) * (boxW / 3)}
              cy={inset + boxH / 2 + (row - 1) * (boxH / 3)}
              r={r}
              fill={colorWithAlpha(dotColor(tile.rank, index, palette), 0.85)}
              stroke={dotColor(tile.rank, index, palette)}
              strokeWidth={bold ? 2 : 1.4}
            />
          ))}
        </G>
      </Svg>
    );
  }

  // Kahoy — jade stalks with a segment mark. The 1 is traditionally the bird,
  // drawn here as a single taller stalk so it still reads at rack size.
  const stalks = tile.rank;
  const columns = stalks === 1 ? 1 : stalks <= 4 ? 2 : 3;
  const rows = Math.ceil(stalks / columns);
  const stalkW = Math.max(2.5, (boxW / columns) * 0.28);
  const stalkH = (boxH / rows) * (stalks === 1 ? 0.9 : 0.72);

  return (
    <Svg width={width} height={height}>
      {Array.from({ length: stalks }).map((_, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const cx = inset + (boxW / columns) * (col + 0.5);
        const cy = inset + (boxH / rows) * (row + 0.5);
        return (
          <G key={index}>
            <Rect
              x={cx - stalkW / 2}
              y={cy - stalkH / 2}
              width={stalkW}
              height={stalkH}
              rx={stalkW / 2.5}
              fill={tile.rank === 1 ? palette.jade : palette.jade}
              opacity={0.95}
            />
            <Rect
              x={cx - stalkW / 2}
              y={cy - (bold ? 1 : 0.75)}
              width={stalkW}
              height={bold ? 2 : 1.5}
              fill={palette.ink}
              opacity={0.28}
            />
          </G>
        );
      })}
    </Svg>
  );
}

function colorWithAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A compact label for the discard pool and for exposed melds, where a full
 * face would be mush: the rank as a numeral, plus the suit as a shape.
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
    <View style={styles.glyph}>
      <Text
        style={{
          fontFamily: type.display,
          fontSize: size * 0.95,
          lineHeight: size * 1.05,
          color: tone,
          includeFontPadding: false,
        }}
      >
        {tile.rank}
      </Text>
      <SuitMark suit={tile.suit} size={size * 0.4} color={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  indexRow: { flexDirection: 'row', alignItems: 'center' },
  glyph: { flexDirection: 'row', alignItems: 'center', gap: 1.5 },
});
