/**
 * The discard pool, in play order so anyone can reconstruct the hand.
 *
 * Each discard is tinted by who threw it, the newest is elevated and ringed,
 * and tapping any tile shows how many of that face remain unseen — the single
 * highest-value piece of information in mahjong, and almost no app surfaces it.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SeatId, Tile as TileModel } from '@bahay/engine';
import { fontSize, radius, space, type } from '../theme/tokens';
import { TileGlyph } from './TileFace';
import { Muted, usePalette } from './ui';
import { Text } from 'react-native';

const SEAT_TINTS: Record<SeatId, string> = {
  0: 'rgba(240,201,122,0.16)',
  1: 'rgba(43,76,126,0.22)',
  2: 'rgba(200,65,47,0.16)',
  3: 'rgba(46,125,91,0.20)',
};

type Props = {
  discards: { tile: TileModel; from: SeatId; claimed: boolean }[];
  tilesRemaining: number;
  onTapTile: (tile: TileModel) => void;
};

export function DiscardPool({ discards, tilesRemaining, onTapTile }: Props) {
  const palette = usePalette();
  const recent = discards.slice(-30);

  return (
    <View style={styles.wrap}>
      <View style={[styles.pool, { borderColor: 'rgba(255,255,255,0.06)' }]}>
        {recent.length === 0 ? (
          <Muted style={{ fontSize: fontSize.small }}>No discards yet</Muted>
        ) : (
          recent.map((discard, index) => {
            const newest = index === recent.length - 1;
            return (
              <Pressable
                key={`${discard.tile.id}-${index}`}
                onPress={() => onTapTile(discard.tile)}
                accessibilityRole="button"
                accessibilityLabel={`discard from seat ${discard.from}`}
                style={[
                  styles.slot,
                  {
                    backgroundColor: palette.tileFace,
                    borderColor: newest ? palette.gold : 'transparent',
                    borderWidth: newest ? 2 : 0,
                    opacity: discard.claimed ? 0.35 : newest ? 1 : 0.72,
                  },
                ]}
              >
                <View style={[styles.tint, { backgroundColor: SEAT_TINTS[discard.from] }]} />
                <TileGlyph tile={discard.tile} size={20} palette={palette} />
              </Pressable>
            );
          })
        )}
      </View>
      <Text
        style={[styles.wallCount, { color: palette.capiz }]}
        numberOfLines={1}
        accessibilityLabel={`${tilesRemaining} tiles left in the wall`}
      >
        WALL · {tilesRemaining} LEFT
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: space.sm },
  pool: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    gap: 5,
  },
  slot: {
    width: 30,
    height: 40,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  wallCount: {
    textAlign: 'center',
    fontFamily: type.displaySemi,
    fontSize: fontSize.micro,
    letterSpacing: 1.6,
    opacity: 0.45,
  },
});
