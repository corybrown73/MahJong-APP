/**
 * Learn.
 *
 * Not a wall of text — a stepped, hands-on sequence. A generation of kids
 * learned mahjong watching their lola play; the ones who didn't have no
 * on-ramp, so this is a first-class feature rather than a help screen.
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { Rank, Suit, Tile as TileModel } from '@bahay/engine';
import { Tile } from '../components/Tile';
import { Body, Button, Card, Muted, Screen, Term, Title, usePalette } from '../components/ui';
import { fontSize, space } from '../theme/tokens';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';

function t(suit: Suit, rank: Rank, copy = 0): TileModel {
  return { kind: 'suited', suit, rank, id: `learn-${suit}-${rank}-${copy}` };
}

function flower(face: string): TileModel {
  return { kind: 'flower', group: 'wind', face, id: `learn-flower-${face}` };
}

type Step = {
  term: string;
  title: string;
  body: string;
  render?: (props: { palette: ReturnType<typeof usePalette> }) => React.ReactNode;
};

export default function LearnScreen() {
  const palette = usePalette();
  const [index, setIndex] = useState(0);
  const { start } = useGame();
  const settings = useSettings();

  const steps = useMemo<Step[]>(
    () => [
      {
        term: 'One',
        title: 'Three suits build every hand',
        body: 'Bolá (balls), kahoy (bamboo) and letra (characters), one through nine, four copies each. That is 108 tiles, and they are the only tiles a hand is made of.',
        render: () => (
          <Row>
            <Tile tile={t('balls', 3)} width={54} palette={palette} />
            <Tile tile={t('sticks', 6)} width={54} palette={palette} />
            <Tile tile={t('chars', 8)} width={54} palette={palette} />
          </Row>
        ),
      },
      {
        term: 'Two',
        title: 'Winds and dragons are set aside',
        body: 'This is where Filipino mahjong parts company with the Chinese game. Winds, dragons, flowers and seasons are all bulaklák — bonus tiles. Draw one and you expose it, take a replacement, and carry on. They never form part of your hand.',
        render: () => (
          <Row>
            <Tile tile={flower('east')} width={54} palette={palette} />
            <Tile tile={flower('red')} width={54} palette={palette} />
            <Tile tile={flower('spring')} width={54} palette={palette} />
          </Row>
        ),
      },
      {
        term: 'Three',
        title: 'Five báhay and an eye',
        body: 'A winning hand is seventeen tiles: five sets and one pair. A set — a báhay — is three in a row in one suit, three of a kind, or four of a kind. The pair is the eye.',
        render: () => (
          <View style={{ gap: space.sm }}>
            <Row>
              <Tile tile={t('balls', 4)} width={40} palette={palette} />
              <Tile tile={t('balls', 5)} width={40} palette={palette} />
              <Tile tile={t('balls', 6)} width={40} palette={palette} />
              <Muted style={{ fontSize: fontSize.small }}>a run</Muted>
            </Row>
            <Row>
              <Tile tile={t('sticks', 7)} width={40} palette={palette} />
              <Tile tile={t('sticks', 7, 1)} width={40} palette={palette} />
              <Tile tile={t('sticks', 7, 2)} width={40} palette={palette} />
              <Muted style={{ fontSize: fontSize.small }}>three of a kind</Muted>
            </Row>
            <Row>
              <Tile tile={t('chars', 2)} width={40} palette={palette} />
              <Tile tile={t('chars', 2, 1)} width={40} palette={palette} />
              <Muted style={{ fontSize: fontSize.small }}>the eye</Muted>
            </Row>
          </View>
        ),
      },
      {
        term: 'Four',
        title: 'Calling a discard',
        body: 'When someone throws a tile you can use, you may call it. Pong takes it for three of a kind, kong for four, chow for a run — but a chow only from the player before you. Mahjongg beats them all: it means the tile finishes your hand.',
        render: () => (
          <Row>
            <Tile tile={t('balls', 5)} width={44} palette={palette} legal />
            <Muted style={{ fontSize: fontSize.small }}>
              A glowing tile is one you can legally call. The call bar lights up too — you never have to go looking.
            </Muted>
          </Row>
        ),
      },
      {
        term: 'Five',
        title: 'Ambitions pay on top',
        body: 'Escalera is 1–9 of one suit. 7 Pairs is seven pairs and a set. Bunot doubles everything when you draw the winning tile yourself. Every kong pays the moment you declare it, win or lose. The win screen itemizes all of it, line by line.',
      },
      {
        term: 'Six',
        title: 'Play a hand with the coach on',
        body: 'Real game, real opponents, hints available and nothing at stake but the chips on the scoreboard. Coach mode shows what you are waiting on; it is one tap away from the table at any time.',
      },
    ],
    [palette],
  );

  const step = steps[index];
  const last = index === steps.length - 1;

  return (
    <Screen>
      <Button label="◀ Back" tone="ghost" onPress={() => router.back()} />

      <Term>
        {step.term} of {steps.length}
      </Term>
      <Title>{step.title}</Title>
      <Body style={{ opacity: 0.85 }}>{step.body}</Body>

      {step.render ? <Card>{step.render({ palette })}</Card> : null}

      <View style={{ flex: 1 }} />

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {index > 0 ? (
          <Button
            label="Back"
            tone="ghost"
            onPress={() => setIndex((n) => n - 1)}
            style={{ flex: 1 }}
          />
        ) : null}
        {last ? (
          <Button
            label="Play with the coach"
            onPress={() => {
              settings.set('coachMode', true);
              start({ ruleset: settings.ruleset });
              router.replace('/table');
            }}
            style={{ flex: 2 }}
          />
        ) : (
          <Button label="Next" onPress={() => setIndex((n) => n + 1)} style={{ flex: 2 }} />
        )}
      </View>
    </Screen>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
      {children}
    </View>
  );
}
