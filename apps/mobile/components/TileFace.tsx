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
import { colors, suitColor, type Palette } from '../theme/tokens';

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

/** A compact label for the discard pool, where a full face would be mush. */
export function TileGlyph({ tile, size, palette = colors }: { tile: Tile; size: number; palette?: Palette }) {
  if (tile.kind === 'flower') {
    return (
      <Text style={{ fontSize: size * 0.62, color: palette.inkSoft, opacity: 0.8 }}>
        {FLOWER_GLYPHS[tile.face] ?? '花'}
      </Text>
    );
  }
  const tone = suitColor(tile.suit, palette);
  if (tile.suit === 'chars') {
    return (
      <Text style={{ fontSize: size * 0.62, color: tone, fontWeight: '700' }}>
        {CHINESE_NUMERALS[tile.rank - 1]}
      </Text>
    );
  }
  if (tile.suit === 'balls') {
    return (
      <Text style={{ fontSize: size * 0.55, color: tone, fontWeight: '700' }}>
        {'●'.repeat(Math.min(tile.rank, 3))}
        {tile.rank > 3 ? tile.rank : ''}
      </Text>
    );
  }
  return (
    <Text style={{ fontSize: size * 0.55, color: tone, fontWeight: '700' }}>
      {'丨'.repeat(Math.min(tile.rank, 3))}
      {tile.rank > 3 ? tile.rank : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
