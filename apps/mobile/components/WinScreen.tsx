/**
 * The itemized settlement, animated in line by line.
 *
 * Players see exactly why they were paid what they were paid. Beginners learn
 * more from this one screen than from any tutorial, and it eliminates the
 * "the game cheated me" feeling that plagues the competition.
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Meld, SeatId, Settlement, Tile as TileModel } from '@bahay/engine';
import { colors, fontSize, motion, radius, space, speedMultiplier, type } from '../theme/tokens';
import { useSettings } from '../store/settings';
import { MeldChip, describeMeld } from './Seats';
import { TileGlyph } from './TileFace';
import { Button } from './ui';

type Props = {
  settlement: Settlement;
  names: Record<SeatId, string>;
  winnerHand: { concealed: TileModel[]; melds: Meld[] } | null;
  onNextHand: () => void;
  onLeave: () => void;
  /** Online: only the host deals, so everyone else waits and is told so. */
  nextHandLabel?: string;
  nextHandDisabled?: boolean;
};

export function WinScreen({
  settlement,
  names,
  winnerHand,
  onNextHand,
  onLeave,
  nextHandLabel = 'Next hand',
  nextHandDisabled = false,
}: Props) {
  const { speed, reducedMotion } = useSettings();
  const [showHand, setShowHand] = useState(false);
  const [visibleLines, setVisibleLines] = useState(reducedMotion ? 99 : 0);

  const lineDelay = Math.round(motion.settlementLine * speedMultiplier[speed]);

  useEffect(() => {
    if (reducedMotion) return;
    const total = settlement.items.length + settlement.multipliers.length + 2;
    let line = 0;
    const id = setInterval(() => {
      line += 1;
      setVisibleLines(line);
      if (line >= total) clearInterval(id);
    }, lineDelay);
    return () => clearInterval(id);
  }, [lineDelay, reducedMotion, settlement]);

  const drawn = settlement.winner === null;
  const title = drawn ? 'WALANG MANALO' : settlement.winType === 'bisaklat' ? 'BISAKLÁT' : 'TÓDAS';
  const subtitle = drawn
    ? 'The wall ran out — nobody pays'
    : `${names[settlement.winner as SeatId]} wins the hand`;

  let line = 0;
  const nextLine = () => visibleLines >= ++line;

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.sm }}>
          <Text style={styles.title}>{spaced(title)}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={{ height: space.md }} />

          {settlement.items.map((item) =>
            nextLine() ? (
              <Animated.View
                key={item.ambition + item.label}
                entering={reducedMotion ? undefined : FadeInDown.duration(180)}
                style={styles.row}
              >
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowValue}>
                  {item.value >= 0 ? '+' : '−'}
                  {Math.abs(item.value).toFixed(2)}
                </Text>
              </Animated.View>
            ) : null,
          )}

          {settlement.multipliers.map((multiplier) =>
            nextLine() ? (
              <Animated.View
                key={multiplier.label}
                entering={reducedMotion ? undefined : FadeInDown.duration(180)}
                style={styles.row}
              >
                <Text style={styles.rowLabel}>{multiplier.label}</Text>
                <Text style={styles.rowValue}>×{multiplier.factor}</Text>
              </Animated.View>
            ) : null,
          )}

          {nextLine() && !drawn ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(180)}
              style={[styles.row, styles.total]}
            >
              <Text style={[styles.rowLabel, styles.totalText]}>Total</Text>
              <Text style={[styles.rowValue, styles.totalValue]}>{settlement.total.toFixed(2)}</Text>
            </Animated.View>
          ) : null}

          {nextLine() ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(180)}
              style={{ marginTop: space.md, gap: 4 }}
            >
              {settlement.transfers.map((transfer) => (
                <View key={`${transfer.from}-${transfer.to}`} style={styles.payRow}>
                  <Text style={styles.payLabel}>
                    {transfer.from === 0 ? 'You pay' : `${names[transfer.from]} pays`}
                  </Text>
                  <Text style={styles.payValue}>−{transfer.amount.toFixed(2)}</Text>
                </View>
              ))}
            </Animated.View>
          ) : null}

          {settlement.markerAward ? (
            <View style={{ marginTop: space.md, gap: 4 }}>
              <View style={styles.payRow}>
                <Text style={styles.payLabel}>
                  {settlement.markerAward.reason} — {names[settlement.markerAward.seat]}
                </Text>
                <Text style={[styles.payValue, { color: colors.vermilion }]}>
                  ◆ +{settlement.markerAward.markers}
                </Text>
              </View>
              {settlement.potWin ? (
                <View style={styles.payRow}>
                  <Text style={[styles.payLabel, { color: colors.vermilion }]}>
                    {names[settlement.potWin.seat]} sweeps the jai alái pot
                  </Text>
                  <Text style={[styles.payValue, { color: colors.vermilion }]}>
                    +{settlement.potWin.amount.toFixed(2)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {settlement.immediate.length > 0 ? (
            <View style={{ marginTop: space.lg, gap: 4 }}>
              <Text style={styles.sectionLabel}>PAID DURING THE HAND</Text>
              {settlement.immediate.map((payout, index) => (
                <View key={`${payout.ambition}-${index}`} style={styles.payRow}>
                  <Text style={styles.payLabel}>
                    {payout.label} — {names[payout.seat]}
                  </Text>
                  <Text style={styles.payValue}>+{payout.amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {showHand && winnerHand ? (
            <View style={{ marginTop: space.lg, gap: space.sm }}>
              <Text style={styles.sectionLabel}>THE WINNING HAND</Text>
              <View style={styles.handRow}>
                {winnerHand.melds.map((meld, index) => (
                  <View key={index} style={{ alignItems: 'center', gap: 2 }}>
                    <MeldChip meld={meld} />
                    <Text style={styles.meldLabel}>{describeMeld(meld)}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.handRow}>
                {winnerHand.concealed.map((tile) => (
                  <View key={tile.id} style={styles.handTile}>
                    <TileGlyph tile={tile} size={16} palette={colors} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.buttons}>
            {winnerHand ? (
              <Button
                label={showHand ? 'Hide the hand' : 'See the hand'}
                tone="ghost"
                onPress={() => setShowHand((value) => !value)}
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              label={nextHandLabel}
              onPress={onNextHand}
              disabled={nextHandDisabled}
              style={{ flex: 1 }}
            />
          </View>
          <Button label="Leave the table" tone="ghost" onPress={onLeave} />
        </ScrollView>
      </View>
    </View>
  );
}

function spaced(text: string): string {
  return text.split('').join(' ');
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,18,13,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    zIndex: 200,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.capiz,
    borderRadius: radius.sheet,
  },
  title: {
    fontFamily: type.display,
    fontSize: fontSize.title,
    letterSpacing: 4,
    textAlign: 'center',
    color: colors.vermilion,
  },
  subtitle: {
    fontFamily: type.body,
    fontSize: fontSize.small,
    textAlign: 'center',
    color: colors.inkSoft,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,22,19,0.08)',
  },
  rowLabel: { fontFamily: type.body, fontSize: fontSize.body, color: colors.ink, flex: 1 },
  rowValue: { fontFamily: type.displaySemi, fontSize: fontSize.body, color: colors.ink },
  total: { borderBottomWidth: 0, borderTopWidth: 2, borderTopColor: colors.ink, marginTop: 6 },
  totalText: { fontSize: fontSize.large },
  totalValue: { fontSize: fontSize.large, color: colors.vermilion },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  payLabel: { fontFamily: type.body, fontSize: fontSize.small, color: colors.inkSoft },
  payValue: { fontFamily: type.bodyMedium, fontSize: fontSize.small, color: colors.inkSoft },
  sectionLabel: {
    fontFamily: type.displaySemi,
    fontSize: fontSize.micro,
    letterSpacing: 1.8,
    color: colors.inkSoft,
  },
  handRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  handTile: {
    width: 22,
    height: 30,
    borderRadius: 4,
    backgroundColor: colors.tileFace,
    borderWidth: 1,
    borderColor: colors.tileEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meldLabel: { fontFamily: type.body, fontSize: 10, color: colors.inkSoft },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
});
