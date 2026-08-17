import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AMBITIONS } from '@bahay/engine';
import { Body, Button, Card, Divider, Muted, Screen, Term, Title } from '../components/ui';
import { fontSize, space } from '../theme/tokens';
import { usePalette } from '../components/ui';
import { useStats } from '../store/stats';

export default function StatsScreen() {
  const stats = useStats();
  const palette = usePalette();
  const winRate = stats.handsPlayed === 0 ? 0 : (stats.handsWon / stats.handsPlayed) * 100;

  return (
    <Screen>
      <Button label="◀ Back" tone="ghost" onPress={() => router.back()} />
      <Title>Stats</Title>

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
          <Stat label="Hands played" value={String(stats.handsPlayed)} />
          <Stat label="Won" value={String(stats.handsWon)} />
          <Stat label="Win rate" value={`${winRate.toFixed(0)}%`} />
          <Stat label="Draws" value={String(stats.handsDrawn)} />
          <Stat
            label="Chips"
            value={`${stats.chipsNet >= 0 ? '+' : '−'}${Math.abs(stats.chipsNet).toFixed(2)}`}
          />
          <Stat label="Best hand" value={stats.bestHand.toFixed(2)} />
          <Stat label="Longest streak" value={String(stats.longestStreak)} />
        </View>
      </Card>

      <Term>Ambitions collected</Term>
      <Muted style={{ fontSize: fontSize.small }}>
        Bisaklát is the rare one — a dealt hand that already wins.
      </Muted>

      <Card>
        {AMBITIONS.map((ambition) => {
          const count = stats.ambitions[ambition.id] ?? 0;
          return (
            <View
              key={ambition.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}
            >
              <Body style={{ opacity: count > 0 ? 1 : 0.4 }}>{ambition.label}</Body>
              <Body style={{ color: count > 0 ? palette.gold : palette.capiz, opacity: count > 0 ? 1 : 0.3 }}>
                {count > 0 ? `×${count}` : '—'}
              </Body>
            </View>
          );
        })}
      </Card>

      <Divider />
      <Button label="Reset stats" tone="ghost" onPress={stats.reset} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 96, gap: 2 }}>
      <Title>{value}</Title>
      <Muted style={{ fontSize: fontSize.small }}>{label}</Muted>
    </View>
  );
}
