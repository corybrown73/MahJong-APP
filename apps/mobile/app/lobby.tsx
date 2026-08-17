/**
 * The lobby — four chairs and a code to read out.
 */

import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { SeatId } from '@bahay/engine';
import type { Difficulty } from '@bahay/ai';
import { Body, Button, Card, Divider, Muted, Screen, Term, Title, usePalette } from '../components/ui';
import { fontSize, radius, space, type } from '../theme/tokens';
import { useRoom } from '../store/room';

const AI_CHOICES: { id: Difficulty; label: string }[] = [
  { id: 'tita', label: 'Tita' },
  { id: 'kapitbahay', label: 'Kapitbahay' },
  { id: 'lolo', label: 'Lolo' },
];

export default function LobbyScreen() {
  const palette = usePalette();
  const room = useRoom();
  const view = room.view;

  // The host starts the hand; everyone else is carried into it.
  useEffect(() => {
    if (view?.status === 'playing') router.replace('/online');
  }, [view?.status]);

  if (!view) {
    return (
      <Screen>
        <Button label="◀ Back" tone="ghost" onPress={() => router.replace('/play')} />
        <Title>Opening the table…</Title>
        <Muted>Connecting.</Muted>
      </Screen>
    );
  }

  const youAreHost = view.seats.some((seat) => seat.isYou && seat.isHost);
  const humans = view.seats.filter((seat) => seat.kind === 'human').length;

  return (
    <Screen>
      <Button
        label="◀ Leave the table"
        tone="ghost"
        onPress={() => {
          room.leave();
          router.replace('/');
        }}
      />

      <Card style={{ alignItems: 'center', gap: 4 }}>
        <Term>Room code</Term>
        <Text
          selectable
          accessibilityLabel={`Room code ${view.code.split('').join(' ')}`}
          style={{
            fontFamily: type.display,
            fontSize: 44,
            letterSpacing: 10,
            color: palette.gold,
          }}
        >
          {view.code}
        </Text>
        <Muted style={{ fontSize: fontSize.small, textAlign: 'center' }}>
          {room.transport?.kind === 'local'
            ? 'A practice table on this phone — the house fills every other seat.'
            : 'Read this out. Anyone who types it in takes the next open chair.'}
        </Muted>
        {room.status.connection !== 'online' ? (
          <Muted style={{ fontSize: fontSize.small, color: palette.vermilion }}>
            {room.status.connection === 'offline' ? 'Reconnecting…' : 'Connecting…'}
          </Muted>
        ) : null}
      </Card>

      <Term>The table</Term>
      {view.seats.map((seat) => (
        <Card key={seat.seat}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Body>
                {seat.name}
                {seat.isYou ? ' · you' : ''}
                {seat.isHost ? ' · host' : ''}
              </Body>
              <Muted style={{ fontSize: fontSize.small }}>
                {seat.kind === 'human'
                  ? seat.connected
                    ? 'Seated'
                    : 'Lost signal — seat held'
                  : seat.kind === 'ai'
                    ? 'The house'
                    : 'Waiting for someone'}
              </Muted>
            </View>
            {seat.kind === 'open' && !seat.isYou && view.yourSeat !== seat.seat ? (
              <Pressable
                onPress={() => room.sit(seat.seat as SeatId)}
                accessibilityRole="button"
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: space.md,
                  borderRadius: radius.pill,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={{ fontFamily: type.bodyMedium, fontSize: fontSize.small, color: palette.capiz }}>
                  Sit here
                </Text>
              </Pressable>
            ) : null}
          </View>

          {youAreHost && seat.kind !== 'human' ? (
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {AI_CHOICES.map((choice) => (
                <Pressable
                  key={choice.id}
                  onPress={() => room.fillSeat(seat.seat as SeatId, choice.id)}
                  accessibilityRole="button"
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: space.md,
                    borderRadius: radius.pill,
                    backgroundColor:
                      seat.kind === 'ai' && seat.name === choice.label
                        ? palette.gold
                        : 'rgba(255,255,255,0.07)',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: type.bodyMedium,
                      fontSize: fontSize.small,
                      color:
                        seat.kind === 'ai' && seat.name === choice.label ? '#2A1D07' : palette.capiz,
                    }}
                  >
                    {choice.label}
                  </Text>
                </Pressable>
              ))}
              {seat.kind === 'ai' ? (
                <Pressable
                  onPress={() => room.openSeat(seat.seat as SeatId)}
                  accessibilityRole="button"
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: space.md,
                    borderRadius: radius.pill,
                    backgroundColor: 'rgba(255,255,255,0.07)',
                  }}
                >
                  <Text style={{ fontFamily: type.bodyMedium, fontSize: fontSize.small, color: palette.capiz }}>
                    Leave it open
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Card>
      ))}

      <Divider />

      <Card>
        <Term>House rules for this table</Term>
        <Muted style={{ fontSize: fontSize.small }}>
          {view.ruleset.label} · joker {view.ruleset.jokerEnabled ? 'on' : 'off'} · chow{' '}
          {view.ruleset.chowFromAnyPlayer ? 'from anyone' : 'from the left'}
          {view.ruleset.jaiAlai.enabled
            ? ` · jai alái to ${view.ruleset.jaiAlai.markersToWin}`
            : ''}
        </Muted>
        <Muted style={{ fontSize: fontSize.small }}>
          {youAreHost
            ? 'Yours, because you opened the table. Change them in House Rules before you start.'
            : "The host's rules bind the whole table."}
        </Muted>
      </Card>

      <View style={{ flex: 1 }} />

      {youAreHost ? (
        <Button
          label={room.starting ? 'Dealing…' : 'Start the hand'}
          disabled={room.starting}
          onPress={room.start}
        />
      ) : (
        <Muted style={{ textAlign: 'center' }}>
          {humans > 1 ? 'Waiting for the host to deal…' : 'Waiting for the host…'}
        </Muted>
      )}
    </Screen>
  );
}
