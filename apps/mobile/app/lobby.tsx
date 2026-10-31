/**
 * The lobby — a code to read out, and four chairs around the table.
 *
 * Tap a chair to choose it. An open one offers "Sit here"; the host can also
 * seat one of the house's players in it, or leave it open for family still on
 * their way.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import type { SeatId } from '@bahay/engine';
import type { Difficulty } from '@bahay/ai';
import { ChairPicker } from '../components/ChairPicker';
import { Body, Button, Card, Muted, Screen, Term, Title, usePalette } from '../components/ui';
import { fontSize, onBrass, radius, space, type } from '../theme/tokens';
import { useRoom } from '../store/room';

const AI_CHOICES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: 'tita', label: 'Tita', blurb: 'chases the big hands' },
  { id: 'kapitbahay', label: 'Kapitbahay', blurb: 'plays it straight' },
  { id: 'lolo', label: 'Lolo', blurb: 'patient, and hard to beat' },
];

const WIND_NAMES = ['East', 'South', 'West', 'North'] as const;

export default function LobbyScreen() {
  const palette = usePalette();
  const room = useRoom();
  const view = room.view;
  const { width } = useWindowDimensions();
  const [chosen, setChosen] = useState<SeatId | null>(null);

  // The host starts the hand; everyone else is carried into it.
  useEffect(() => {
    if (view?.status === 'playing') router.replace('/online');
  }, [view?.status]);

  if (!view) {
    return (
      <Screen>
        <Button label="‹ Back" tone="ghost" onPress={() => router.replace('/play')} />
        <Title>Opening the table…</Title>
        <Muted>Connecting.</Muted>
      </Screen>
    );
  }

  const youAreHost = view.seats.some((seat) => seat.isYou && seat.isHost);
  const humans = view.seats.filter((seat) => seat.kind === 'human').length;
  const pickerWidth = Math.min(width - space.xl * 2, 380);
  const focus = chosen === null ? null : view.seats[chosen];
  const canSit = !!focus && focus.kind !== 'human';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => {
            room.leave();
            router.replace('/');
          }}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={{ fontFamily: type.bodyMedium, fontSize: fontSize.small, color: palette.capiz, opacity: 0.85 }}>
            ‹ Leave the table
          </Text>
        </Pressable>
        {room.status.connection !== 'online' ? (
          <Text style={{ fontFamily: type.label, fontSize: fontSize.micro, color: palette.led }}>
            {room.status.connection === 'offline' ? 'RECONNECTING…' : 'CONNECTING…'}
          </Text>
        ) : null}
      </View>

      <View style={{ alignItems: 'center', gap: 2 }}>
        <Term>Table code</Term>
        <Text
          selectable
          accessibilityLabel={`Table code ${view.code.split('').join(' ')}`}
          style={{
            fontFamily: type.display,
            fontSize: 44,
            letterSpacing: 9,
            color: palette.goldGlow,
          }}
        >
          {view.code}
        </Text>
        <Muted style={{ fontSize: fontSize.small, textAlign: 'center' }}>
          {room.transport?.kind === 'local'
            ? 'A practice table on this phone — the house takes any chair you leave.'
            : 'Read it out. Whoever types it in pulls up a chair.'}
        </Muted>
      </View>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Term>Choose your chair</Term>
        <ChairPicker
          width={pickerWidth}
          seats={view.seats}
          selected={chosen}
          onSelect={setChosen}
          palette={palette}
        />
      </View>

      {focus ? (
        <Card style={{ gap: space.md }}>
          <View style={{ gap: 2 }}>
            <Term>{WIND_NAMES[focus.seat]} chair</Term>
            <Body>
              {focus.kind === 'open'
                ? 'Empty — nobody has pulled it up yet.'
                : focus.isYou
                  ? 'This is your chair.'
                  : focus.kind === 'ai'
                    ? `${focus.name} is keeping it warm for the house.`
                    : `${focus.name}${focus.connected ? ' is sitting here.' : ' lost signal — the chair is held.'}`}
            </Body>
            {focus.seat === 0 ? (
              <Muted style={{ fontSize: fontSize.small }}>East deals the first hand.</Muted>
            ) : null}
          </View>

          {canSit ? (
            <Button
              label="Sit here"
              onPress={() => {
                room.sit(focus.seat as SeatId);
              }}
            />
          ) : null}

          {youAreHost && focus.kind !== 'human' ? (
            <View style={{ gap: space.sm }}>
              <Muted style={{ fontSize: fontSize.small }}>Or seat the house here:</Muted>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                {AI_CHOICES.map((choice) => {
                  const active = focus.kind === 'ai' && focus.name.startsWith(choice.label);
                  return (
                    <Pressable
                      key={choice.id}
                      onPress={() => room.fillSeat(focus.seat as SeatId, choice.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Seat ${choice.label}, who ${choice.blurb}`}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: space.md,
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderColor: active ? palette.goldGlow : 'rgba(201,161,90,0.3)',
                        backgroundColor: active ? palette.gold : 'rgba(255,236,214,0.04)',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: type.label,
                          fontSize: fontSize.small,
                          color: active ? onBrass : palette.capiz,
                        }}
                      >
                        {choice.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {focus.kind === 'ai' ? (
                  <Pressable
                    onPress={() => room.openSeat(focus.seat as SeatId)}
                    accessibilityRole="button"
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: space.md,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: 'rgba(244,238,227,0.18)',
                    }}
                  >
                    <Text style={{ fontFamily: type.label, fontSize: fontSize.small, color: palette.capiz }}>
                      Leave it open
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </Card>
      ) : (
        <Muted style={{ textAlign: 'center', fontSize: fontSize.small }}>
          Tap a chair to sit in it{youAreHost ? ', or to seat the house there' : ''}.
        </Muted>
      )}

      <Card>
        <Term>House rules at this table</Term>
        <Muted style={{ fontSize: fontSize.small }}>
          {view.ruleset.label} · joker {view.ruleset.jokerEnabled ? 'on' : 'off'} · chow{' '}
          {view.ruleset.chowFromAnyPlayer ? 'from anyone' : 'from the left'}
          {view.ruleset.jaiAlai.enabled ? ` · jai alái to ${view.ruleset.jaiAlai.markersToWin}` : ''}
        </Muted>
        <Muted style={{ fontSize: fontSize.small }}>
          {youAreHost
            ? 'Yours, because you opened the table. Change them in House Rules before you deal.'
            : "The host's rules bind the whole table."}
        </Muted>
      </Card>

      <View style={{ flex: 1 }} />

      {youAreHost ? (
        <Button
          label={room.starting ? 'Shuffling…' : 'Deal the first hand'}
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
