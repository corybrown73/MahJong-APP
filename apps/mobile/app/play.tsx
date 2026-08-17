/**
 * Who are you playing with?
 *
 * Room codes, not matchmaking — the use case is a family across three cities,
 * not a ranked ladder.
 */

import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, Muted, Screen, Term, Title, usePalette } from '../components/ui';
import { fontSize, radius, space, type } from '../theme/tokens';
import { getIdentity, setDisplayName } from '../lib/identity';
import { onlinePlayAvailable } from '../lib/supabaseTransport';
import { useRoom } from '../store/room';
import { useSettings } from '../store/settings';

export default function PlayScreen() {
  const palette = usePalette();
  const ruleset = useSettings((s) => s.ruleset);
  const room = useRoom();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const online = onlinePlayAvailable();

  useEffect(() => {
    void getIdentity().then((identity) => setName(identity.name));
  }, []);

  const saveName = async () => {
    await setDisplayName(name);
  };

  return (
    <Screen>
      <Button label="◀ Back" tone="ghost" onPress={() => router.back()} />
      <Title>Play with your family</Title>
      <Muted>
        One person opens a table and reads out the code. Everyone else types it
        in. Any seat nobody takes is played by the house.
      </Muted>

      <Card>
        <Term>Your name at the table</Term>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={saveName}
          placeholder="Player"
          placeholderTextColor="rgba(255,253,247,0.35)"
          maxLength={16}
          accessibilityLabel="Your name at the table"
          style={{
            fontFamily: type.body,
            fontSize: fontSize.body,
            color: palette.capiz,
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderRadius: radius.card,
            paddingHorizontal: space.lg,
            paddingVertical: 12,
          }}
        />
      </Card>

      {room.joinError ? (
        <Card style={{ borderColor: palette.vermilion }}>
          <Body>{room.joinError}</Body>
        </Card>
      ) : null}

      <Card>
        <Term>Open a table</Term>
        <Muted style={{ fontSize: fontSize.small }}>
          You host, so your house rules are the ones everybody plays.
        </Muted>
        <Button
          label={busy ? 'Opening…' : 'Open a table'}
          disabled={busy || !online}
          onPress={async () => {
            setBusy(true);
            await saveName();
            const opened = await room.hostOnline(ruleset);
            setBusy(false);
            if (opened) router.push('/lobby');
          }}
        />
        {!online ? (
          <Muted style={{ fontSize: fontSize.small }}>
            This build has no server configured, so online tables are off. A
            practice table below works exactly the same way.
          </Muted>
        ) : null}
      </Card>

      <Card>
        <Term>Join a table</Term>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            value={code}
            onChangeText={(next) => setCode(next.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="CODE"
            placeholderTextColor="rgba(255,253,247,0.35)"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            accessibilityLabel="Room code"
            style={{
              flex: 1,
              fontFamily: type.display,
              fontSize: fontSize.large,
              letterSpacing: 6,
              color: palette.capiz,
              backgroundColor: 'rgba(255,255,255,0.07)',
              borderRadius: radius.card,
              paddingHorizontal: space.lg,
              paddingVertical: 12,
            }}
          />
          <Button
            label="Join"
            disabled={code.length < 4 || busy || !online}
            onPress={async () => {
              setBusy(true);
              await saveName();
              const joined = await room.joinOnline(code);
              setBusy(false);
              if (joined) router.push('/lobby');
            }}
          />
        </View>
      </Card>

      <Card>
        <Term>Practice table</Term>
        <Muted style={{ fontSize: fontSize.small }}>
          The same table, run on this phone, with the house in every other
          seat. No connection needed.
        </Muted>
        <Button
          label="Open a practice table"
          tone="secondary"
          onPress={async () => {
            await saveName();
            await room.hostLocal(ruleset);
            router.push('/lobby');
          }}
        />
      </Card>
    </Screen>
  );
}
