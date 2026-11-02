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
import { describeMeld } from './Seats';
import { Tile } from './Tile';
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
  /**
   * The session has run its rounds. There is no next hand — the table shows
   * where everyone finished instead.
   */
  finalStanding?: { seat: SeatId; chips: number }[] | null;
};

export function WinScreen({
  settlement,
  names,
  winnerHand,
  onNextHand,
  onLeave,
  nextHandLabel = 'Next hand',
  nextHandDisabled = false,
  finalStanding = null,
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
  const title = drawn ? 'WALANG MANALO' : settlement.winType === 'bisaklat' ? 'BISAKLAT' : 'MAHJONGG';
  // Two seats can win one discard when the table plays multiple winners, so
  // the header names everyone who was paid rather than just the first.
  const coWinners = settlement.coWinners ?? [];
  const winnerNames = [settlement.winner, ...coWinners.map((s) => s.winner)]
    .filter((seat): seat is SeatId => seat !== null)
    .map((seat) => names[seat]);
  const subtitle = drawn
    ? 'The wall ran out — nobody pays'
    : coWinners.length > 0
      ? `${winnerNames.join(' and ')} both win the hand`
      : winnerNames[0] === 'You'
        ? 'You win the hand'
        : `${winnerNames[0]} wins the hand`;

  let line = 0;
  const nextLine = () => visibleLines >= ++line;

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.sm }}>
          <Text
            style={[styles.title, title.length > 10 ? { fontSize: 24, letterSpacing: 2 } : null]}
            numberOfLines={1}
          >
            {title}
          </Text>
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
                    {coWinners.length > 0 ? ` ${names[transfer.to]}` : ''}
                  </Text>
                  <Text style={styles.payValue}>−{transfer.amount.toFixed(2)}</Text>
                </View>
              ))}
            </Animated.View>
          ) : null}

          {coWinners.map((other) =>
            other.winner === null ? null : (
              <View key={other.winner} style={{ marginTop: space.md, gap: 4 }}>
                <Text style={styles.subtitle}>{names[other.winner]}</Text>
                {other.items.map((item) => (
                  <View key={item.ambition + item.label} style={styles.row}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowValue}>
                      {item.value >= 0 ? '+' : '−'}
                      {Math.abs(item.value).toFixed(2)}
                    </Text>
                  </View>
                ))}
                {other.multipliers.map((multiplier) => (
                  <View key={multiplier.label} style={styles.row}>
                    <Text style={styles.rowLabel}>{multiplier.label}</Text>
                    <Text style={styles.rowValue}>×{multiplier.factor}</Text>
                  </View>
                ))}
                <View style={[styles.row, styles.total]}>
                  <Text style={[styles.rowLabel, styles.totalText]}>Total</Text>
                  <Text style={[styles.rowValue, styles.totalValue]}>{other.total.toFixed(2)}</Text>
                </View>
              </View>
            ),
          )}

          {settlement.markerAward ? (
            <View style={{ marginTop: space.md, gap: 4 }}>
              <View style={styles.payRow}>
                <Text style={styles.payLabel}>
                  {settlement.markerAward.reason} — {names[settlement.markerAward.seat]}
                </Text>
                <Text style={[styles.payValue, { color: colors.goldGlow }]}>
                  ◆ +{settlement.markerAward.markers}
                </Text>
              </View>
              {settlement.potWin ? (
                <View style={styles.payRow}>
                  <Text style={[styles.payLabel, { color: colors.goldGlow }]}>
                    {names[settlement.potWin.seat]} sweeps the jai alái pot
                  </Text>
                  <Text style={[styles.payValue, { color: colors.goldGlow }]}>
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
                  <View key={index} style={{ alignItems: 'center', gap: 3 }}>
                    <View style={{ flexDirection: 'row', gap: 1 }}>
                      {meld.tiles.map((tile, i) => (
                        <Tile
                          key={tile.id ?? i}
                          tile={tile}
                          width={22}
                          flat
                          faceDown={meld.type === 'kang' && meld.variant === 'secret' && i < 3}
                        />
                      ))}
                    </View>
                    <Text style={styles.meldLabel}>{describeMeld(meld)}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.handRow}>
                {winnerHand.concealed.map((tile) => (
                  <Tile key={tile.id} tile={tile} width={24} flat />
                ))}
              </View>
            </View>
          ) : null}

          {finalStanding ? (
            <View style={{ marginTop: space.lg, gap: 4 }}>
              <Text style={styles.sectionLabel}>THAT IS THE GAME</Text>
              {finalStanding.map((entry, index) => (
                <View key={entry.seat} style={styles.payRow}>
                  <Text style={styles.payLabel}>
                    {index + 1}. {names[entry.seat]}
                  </Text>
                  <Text
                    style={[
                      styles.payValue,
                      { color: index === 0 ? colors.goldGlow : undefined },
                    ]}
                  >
                    {entry.chips >= 0 ? '+' : '−'}
                    {Math.abs(entry.chips).toFixed(2)}
                  </Text>
                </View>
              ))}
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
            {finalStanding ? null : (
              <Button
                label={nextHandLabel}
                onPress={onNextHand}
                disabled={nextHandDisabled}
                style={{ flex: 1 }}
              />
            )}
          </View>
          <Button label={finalStanding ? 'Done' : 'Leave the table'} tone="ghost" onPress={onLeave} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,6,5,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    zIndex: 200,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.lacquerLight,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(201,161,90,0.55)',
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
  },
  title: {
    fontFamily: type.display,
    fontSize: fontSize.title + 6,
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.goldGlow,
  },
  subtitle: {
    fontFamily: type.displayItalic,
    fontSize: fontSize.body,
    textAlign: 'center',
    color: colors.capiz,
    opacity: 0.8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,161,90,0.14)',
  },
  rowLabel: { fontFamily: type.body, fontSize: fontSize.body, color: colors.capiz, flex: 1 },
  rowValue: { fontFamily: type.displaySemi, fontSize: fontSize.body, color: colors.capiz },
  total: {
    borderBottomWidth: 0,
    borderTopWidth: 1.5,
    borderTopColor: colors.gold,
    marginTop: 6,
  },
  totalText: { fontSize: fontSize.large, fontFamily: type.displaySemi },
  totalValue: { fontSize: fontSize.large + 2, color: colors.goldGlow, fontFamily: type.display },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  payLabel: { fontFamily: type.body, fontSize: fontSize.small, color: colors.capiz, opacity: 0.72 },
  payValue: { fontFamily: type.bodyMedium, fontSize: fontSize.small, color: colors.capiz, opacity: 0.85 },
  sectionLabel: {
    fontFamily: type.label,
    fontSize: fontSize.micro,
    letterSpacing: 2.2,
    color: colors.gold,
  },
  handRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'flex-end' },
  meldLabel: { fontFamily: type.body, fontSize: 10, color: colors.capiz, opacity: 0.6 },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
});
