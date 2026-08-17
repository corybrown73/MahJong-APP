import React from 'react';
import { router } from 'expo-router';
import { Button, Card, Choice, Muted, Screen, Term, Title, Toggle } from '../components/ui';
import { fontSize } from '../theme/tokens';
import { useSettings } from '../store/settings';

export default function SettingsScreen() {
  const settings = useSettings();

  return (
    <Screen>
      <Button label="◀ Back" tone="ghost" onPress={() => router.back()} />
      <Title>Settings</Title>

      <Card>
        <Term>Pace</Term>
        <Muted style={{ fontSize: fontSize.small }}>
          Relaxed is the default: slow enough to follow every call.
        </Muted>
        <Choice
          label=""
          value={settings.speed}
          options={[
            { value: 'relaxed' as const, label: 'Relaxed' },
            { value: 'normal' as const, label: 'Normal' },
            { value: 'fast' as const, label: 'Fast' },
          ]}
          onChange={(value) => settings.set('speed', value)}
        />
      </Card>

      <Card>
        <Term>Reading the table</Term>
        <Toggle
          label="High contrast"
          description="Darkens the felt and thickens every engraving."
          value={settings.highContrast}
          onChange={(value) => settings.set('highContrast', value)}
        />
        <Toggle
          label="Reduced motion"
          description="Replaces movement with cross-fades."
          value={settings.reducedMotion}
          onChange={(value) => settings.set('reducedMotion', value)}
        />
        <Choice
          label="Tile size"
          value={settings.tileScale}
          options={[
            { value: 0.9, label: 'Small' },
            { value: 1, label: 'Standard' },
            { value: 1.15, label: 'Large' },
          ]}
          onChange={(value) => settings.set('tileScale', value)}
        />
      </Card>

      <Card>
        <Term>Sound and touch</Term>
        <Toggle
          label="Sound"
          description="Off by default. Calls are announced visually first."
          value={settings.sound}
          onChange={(value) => settings.set('sound', value)}
        />
        <Toggle
          label="Haptics"
          description="A light tap on select, a firmer one on a call."
          value={settings.haptics}
          onChange={(value) => settings.set('haptics', value)}
        />
      </Card>

      <Card>
        <Term>Playing</Term>
        <Toggle
          label="Undo window"
          description="Hold a confirmed discard for a moment and offer an undo."
          value={settings.undoWindow}
          onChange={(value) => settings.set('undoWindow', value)}
        />
        <Toggle
          label="Coach mode"
          description="Shows what you are waiting on. Always one tap away on the table too."
          value={settings.coachMode}
          onChange={(value) => settings.set('coachMode', value)}
        />
        <Choice
          label="Language"
          value={settings.language}
          options={[
            { value: 'en' as const, label: 'English' },
            { value: 'tl' as const, label: 'Tagalog' },
          ]}
          onChange={(value) => settings.set('language', value)}
        />
        <Muted style={{ fontSize: fontSize.small }}>
          Filipino terms stay Filipino either way — tódas, búnot, báhay, sagása.
        </Muted>
      </Card>
    </Screen>
  );
}
