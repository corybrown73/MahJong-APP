import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, Display, Muted, Screen, Term, Title } from '../components/ui';
import { space } from '../theme/tokens';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';
import { useStats } from '../store/stats';

export default function Home() {
  const { start, resume, hasSavedGame, checkSaved } = useGame();
  const ruleset = useSettings((s) => s.ruleset);
  const stats = useStats();

  useEffect(() => {
    void checkSaved();
  }, [checkSaved]);

  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: 6 }}>
        <Display>
          BÁ<Term style={{ fontSize: 34, letterSpacing: 0 }}>HAY</Term>
        </Display>
        <Term>Filipino Mahjong</Term>
        <Muted style={{ textAlign: 'center', maxWidth: 300 }}>
          Five báhay and an eye. Sixteen tiles, four players, and every call
          announced so you can follow the whole hand.
        </Muted>
      </View>

      {hasSavedGame ? (
        <Card>
          <Term>Hand in progress</Term>
          <Body>Pick up where you left off.</Body>
          <Button
            label="Resume"
            onPress={async () => {
              const ok = await resume();
              if (ok) router.push('/table');
            }}
            style={{ marginTop: space.sm }}
          />
        </Card>
      ) : null}

      <Button
        label="Play"
        onPress={() => {
          start({ ruleset });
          router.push('/table');
        }}
      />
      <Button label="Learn" tone="secondary" onPress={() => router.push('/learn')} />
      <Button label="House Rules" tone="ghost" onPress={() => router.push('/rules')} />
      <Button label="Stats" tone="ghost" onPress={() => router.push('/stats')} />
      <Button label="Settings" tone="ghost" onPress={() => router.push('/settings')} />

      <View style={{ flex: 1 }} />

      <Card>
        <Term>The table so far</Term>
        <Title>
          {stats.handsWon} / {stats.handsPlayed}
        </Title>
        <Muted>
          hands won · {stats.chipsNet >= 0 ? '+' : '−'}
          {Math.abs(stats.chipsNet).toFixed(2)} chips · playing {ruleset.label}
        </Muted>
      </Card>
    </Screen>
  );
}
