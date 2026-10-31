import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Tile as TileModel } from '@bahay/engine';
import { Emblem, Wordmark } from '../components/Brand';
import { Tile } from '../components/Tile';
import { Body, Button, Card, Muted, Screen, Term, usePalette } from '../components/ui';
import { fontSize, radius, space, type } from '../theme/tokens';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';
import { useStats } from '../store/stats';

/** A fanned hand under the name — the tiles are the brand. */
const FAN: TileModel[] = [
  { kind: 'suited', suit: 'balls', rank: 1, id: 'fan-1' },
  { kind: 'suited', suit: 'chars', rank: 5, id: 'fan-2' },
  { kind: 'suited', suit: 'sticks', rank: 9, id: 'fan-3' },
  { kind: 'suited', suit: 'chars', rank: 8, id: 'fan-4' },
  { kind: 'suited', suit: 'balls', rank: 7, id: 'fan-5' },
];

export default function Home() {
  const palette = usePalette();
  const { start, resume, hasSavedGame, checkSaved } = useGame();
  const ruleset = useSettings((s) => s.ruleset);
  const stats = useStats();

  useEffect(() => {
    void checkSaved();
  }, [checkSaved]);

  return (
    <Screen>
      <View style={styles.hero}>
        <Emblem size={64} palette={palette} />
        <Wordmark size={54} palette={palette} />
        <Text style={[styles.tagline, { color: palette.capiz }]}>
          Five báhay and an eye.
        </Text>
      </View>

      <View style={styles.fan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {FAN.map((tile, index) => {
          const middle = (FAN.length - 1) / 2;
          const turn = (index - middle) * 9;
          return (
            <View
              key={tile.id}
              style={{
                marginLeft: index === 0 ? 0 : -14,
                transform: [{ translateY: Math.abs(index - middle) * 7 }, { rotate: `${turn}deg` }],
                zIndex: index,
              }}
            >
              <Tile tile={tile} width={50} palette={palette} />
            </View>
          );
        })}
      </View>

      {hasSavedGame ? (
        <Card>
          <Term>Hand in progress</Term>
          <Body>Your tiles are where you left them.</Body>
          <Button
            label="Resume"
            tone="secondary"
            onPress={async () => {
              const ok = await resume();
              if (ok) router.push('/table');
            }}
            style={{ marginTop: space.sm }}
          />
        </Card>
      ) : null}

      <View style={{ gap: space.md }}>
        <Button
          label="Play"
          onPress={() => {
            start({ ruleset });
            router.push('/table');
          }}
        />
        <Button label="Play with family" tone="secondary" onPress={() => router.push('/play')} />
      </View>

      <View style={styles.grid}>
        <MenuTile glyph="學" label="Learn" onPress={() => router.push('/learn')} />
        <MenuTile glyph="規" label="House rules" onPress={() => router.push('/rules')} />
        <MenuTile glyph="記" label="Stats" onPress={() => router.push('/stats')} />
        <MenuTile glyph="設" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.footer}>
        <Text style={[styles.footerNumber, { color: palette.goldGlow }]}>
          {stats.handsWon}
          <Text style={{ color: palette.capiz, opacity: 0.5 }}> / {stats.handsPlayed}</Text>
        </Text>
        <Muted style={{ fontSize: fontSize.small, textAlign: 'center' }}>
          hands won · {stats.chipsNet >= 0 ? '+' : '−'}
          {Math.abs(stats.chipsNet).toFixed(2)} chips · playing {ruleset.label}
        </Muted>
      </View>
    </Screen>
  );
}

function MenuTile({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.menuTile,
        {
          borderColor: 'rgba(201,161,90,0.24)',
          backgroundColor: pressed ? 'rgba(201,161,90,0.12)' : 'rgba(255,236,214,0.035)',
        },
      ]}
    >
      <Text style={[styles.menuGlyph, { color: palette.gold }]}>{glyph}</Text>
      <Text style={[styles.menuLabel, { color: palette.capiz }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: space.lg, gap: space.sm },
  tagline: {
    fontFamily: type.displayItalic,
    fontSize: fontSize.large,
    opacity: 0.82,
    marginTop: space.xs,
  },
  fan: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  menuTile: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  menuGlyph: { fontSize: 22, fontWeight: '600' },
  menuLabel: {
    fontFamily: type.label,
    fontSize: fontSize.small,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  footer: { alignItems: 'center', gap: 2, paddingTop: space.md },
  footerNumber: { fontFamily: type.display, fontSize: fontSize.title },
});
