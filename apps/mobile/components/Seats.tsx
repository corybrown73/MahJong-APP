/**
 * The other three players.
 *
 * Seat 2 sits across the table, seat 1 on the right (plays after you) and seat
 * 3 on the left (plays before you — the only seat you may chow from). Whoever
 * is acting is ringed in gold, so the player is never left wondering whose turn
 * it is. Exposed melds render small but never overlap, and name themselves on
 * tap.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Meld, SeatId } from '@bahay/engine';
import { fontSize, radius, space, type } from '../theme/tokens';
import { TileGlyph } from './TileFace';
import { usePalette } from './ui';

type SeatSummary = {
  seat: SeatId;
  name: string;
  concealedCount: number;
  melds: Meld[];
  flowers: number;
  chips: number;
  isDealer: boolean;
};

export function OpponentStrip({
  summary,
  active,
  orientation,
  onMeldPress,
}: {
  summary: SeatSummary;
  active: boolean;
  orientation: 'top' | 'left' | 'right';
  onMeldPress?: (meld: Meld) => void;
}) {
  const palette = usePalette();
  const vertical = orientation !== 'top';

  return (
    <View style={[styles.seat, vertical ? styles.seatVertical : null]}>
      <Text
        style={[
          styles.name,
          {
            color: active ? palette.gold : palette.capiz,
            opacity: active ? 1 : 0.55,
          },
        ]}
        numberOfLines={1}
      >
        {active ? '◆ ' : ''}
        {summary.name}
        {summary.isDealer ? ' · máno' : ''}
      </Text>

      <View style={[styles.backs, vertical ? styles.backsVertical : null]}>
        {Array.from({ length: Math.min(summary.concealedCount, vertical ? 6 : 10) }).map((_, i) => (
          <View
            key={i}
            style={[
              vertical ? styles.miniVertical : styles.mini,
              { backgroundColor: palette.tileBack, borderBottomColor: palette.tileBackDark },
            ]}
          />
        ))}
        {summary.concealedCount > (vertical ? 6 : 10) ? (
          <Text style={[styles.count, { color: palette.capiz }]}>
            +{summary.concealedCount - (vertical ? 6 : 10)}
          </Text>
        ) : null}
      </View>

      {summary.melds.length > 0 ? (
        <View style={[styles.melds, vertical ? styles.meldsVertical : null]}>
          {summary.melds.map((meld, index) => (
            <MeldChip key={index} meld={meld} onPress={() => onMeldPress?.(meld)} />
          ))}
        </View>
      ) : null}

      <Text style={[styles.meta, { color: palette.capiz }]}>
        {summary.flowers > 0 ? `🌸 ${summary.flowers}  ` : ''}
        {summary.chips >= 0 ? '' : '−'}
        {Math.abs(summary.chips).toFixed(2)}
      </Text>
    </View>
  );
}

export function MeldChip({ meld, onPress }: { meld: Meld; onPress?: () => void }) {
  const palette = usePalette();
  const faceDown = meld.type === 'kang' && meld.variant === 'secret';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={describeMeld(meld)}
      style={[styles.meld, { backgroundColor: 'rgba(0,0,0,0.2)' }]}
    >
      {meld.tiles.map((tile, index) => (
        <View
          key={tile.id ?? index}
          style={[
            styles.meldTile,
            {
              backgroundColor: faceDown ? palette.tileBack : palette.tileFace,
            },
          ]}
        >
          {faceDown ? null : <TileGlyph tile={tile} size={13} palette={palette} />}
        </View>
      ))}
    </Pressable>
  );
}

export function describeMeld(meld: Meld): string {
  const names = { balls: 'bolá', sticks: 'kahoy', chars: 'letra' } as const;
  const suited = meld.tiles.find((t) => t.kind === 'suited');
  const suit = suited && suited.kind === 'suited' ? names[suited.suit] : '';
  const ranks = meld.tiles
    .filter((t) => t.kind === 'suited')
    .map((t) => (t.kind === 'suited' ? t.rank : 0))
    .join('-');
  const label =
    meld.type === 'kang'
      ? meld.variant === 'secret'
        ? 'secret kang'
        : meld.variant === 'sagasa'
          ? 'sagása'
          : 'kang'
      : meld.type;
  return `${label} — ${ranks} ${suit}`;
}

const styles = StyleSheet.create({
  seat: { alignItems: 'center', gap: 4 },
  seatVertical: { maxWidth: 96 },
  name: {
    fontFamily: type.displaySemi,
    fontSize: fontSize.micro,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  backs: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  backsVertical: { flexWrap: 'wrap', justifyContent: 'center', maxWidth: 92 },
  mini: { width: 15, height: 21, borderRadius: 3, borderBottomWidth: 2 },
  miniVertical: { width: 13, height: 18, borderRadius: 3 },
  count: { fontFamily: type.body, fontSize: fontSize.micro, opacity: 0.5, marginLeft: 2 },
  melds: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', justifyContent: 'center' },
  meldsVertical: { maxWidth: 92 },
  meld: { flexDirection: 'row', gap: 1, padding: 2, borderRadius: radius.tile - 2 },
  meldTile: {
    width: 15,
    height: 20,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { fontFamily: type.body, fontSize: fontSize.micro, opacity: 0.5 },
  spacer: { width: space.sm },
});
