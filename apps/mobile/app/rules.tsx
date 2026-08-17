/**
 * House Rules.
 *
 * Every family plays differently, so the ruleset is a config object rather than
 * a hardcoded assumption — presets plus a custom set, in plain language.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  AMBITIONS,
  ambitionValue,
  cloneRuleset,
  PRESETS,
  type AmbitionId,
  type JaiAlaiRules,
  type Ruleset,
} from '@bahay/engine';
import {
  Body,
  Button,
  Card,
  Choice,
  Divider,
  Muted,
  Screen,
  Term,
  Title,
  Toggle,
  usePalette,
} from '../components/ui';
import { fontSize, radius, space, type } from '../theme/tokens';
import { useSettings } from '../store/settings';

const FLAGS: {
  key: keyof Ruleset;
  label: string;
  description: string;
}[] = [
  {
    key: 'jokerEnabled',
    label: 'Joker',
    description: 'One suited face is turned up at the deal; all four copies are wild.',
  },
  {
    key: 'doublesOnDoubleRoll',
    label: 'Doubles on a double roll',
    description: 'If the wall-breaking roll is doubles, every payout this hand is doubled.',
  },
  {
    key: 'robbingTheKang',
    label: 'Rob the Kong',
    description: 'A sagasa tile that completes another hand may be taken for the win (RTK).',
  },
  {
    key: 'chowFromAnyPlayer',
    label: 'Chow from anyone',
    description: 'Standard play allows a chow only from the player before you.',
  },
  {
    key: 'multipleWinnersOnDiscard',
    label: 'Pay every winner',
    description: 'When two players call mahjongg on the same tile, pay both instead of the nearer one.',
  },
  {
    key: 'sieteParesRequiresConcealed',
    label: '7 Pairs must be concealed',
    description: 'Some tables only pay seven pairs if nothing was exposed.',
  },
  {
    key: 'drawEndsDealership',
    label: 'A draw ends the dealership',
    description: 'By default the máno keeps the deal when the wall runs out.',
  },
  {
    key: 'bisaklatStacksAmbitions',
    label: 'Bisaklat Escalera / 7 Pairs',
    description: 'A dealt winning hand that also carries a shape ambition pays it on top.',
  },
];

/**
 * The six the house book marks with M/, plus the two it scores as ordinary
 * bonuses — All chow and All up are listed so a table can add them, but they
 * start off, because in this book they are +5s and not majors.
 */
const MAJOR_CANDIDATES: { id: AmbitionId; label: string }[] = [
  { id: 'allPungs', label: 'All pong' },
  { id: 'escalera', label: 'Escalera' },
  { id: 'noFlowers', label: 'Sin Flores' },
  { id: 'sietePares', label: '7 Pairs' },
  { id: 'allRevealed', label: 'All down' },
  { id: 'fullFlush', label: 'Same suit' },
  { id: 'allChows', label: 'All chow' },
  { id: 'concealedHand', label: 'All up' },
];

export default function RulesScreen() {
  const { ruleset, setRuleset } = useSettings();
  const palette = usePalette();

  const update = (patch: Partial<Ruleset>) =>
    setRuleset({ ...cloneRuleset(ruleset), ...patch, id: 'house', label: 'Our House' });

  const updateJaiAlai = (patch: Partial<JaiAlaiRules>) =>
    setRuleset({
      ...cloneRuleset(ruleset),
      id: 'house',
      label: 'Our House',
      jaiAlai: {
        ...ruleset.jaiAlai,
        markerAwards: { ...ruleset.jaiAlai.markerAwards },
        majors: [...ruleset.jaiAlai.majors],
        ...patch,
      },
    });

  const setAmbition = (id: AmbitionId, value: number) =>
    setRuleset({
      ...cloneRuleset(ruleset),
      id: 'house',
      label: 'Our House',
      ambitionValues: { ...ruleset.ambitionValues, [id]: value },
    });

  return (
    <Screen>
      <Button label="◀ Back" tone="ghost" onPress={() => router.back()} />
      <Title>House Rules</Title>
      <Muted>
        Every family plays differently. Dial in exactly how your table plays — it
        changes the engine, not just the wording.
      </Muted>

      <Choice
        label="Preset"
        value={ruleset.id}
        options={PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
        onChange={(id) => {
          const preset = PRESETS.find((p) => p.id === id);
          if (preset) setRuleset(cloneRuleset(preset));
        }}
      />

      <Divider />

      <Card>
        {FLAGS.map((flag) => (
          <Toggle
            key={String(flag.key)}
            label={flag.label}
            description={flag.description}
            value={Boolean(ruleset[flag.key])}
            onChange={(next) => update({ [flag.key]: next } as Partial<Ruleset>)}
          />
        ))}
      </Card>

      <Card>
        <Term>Jai alái — the marker pot</Term>
        <Muted style={{ fontSize: fontSize.small }}>
          Everyone antes into a pot. A win earns a marker (talbog), a búnot or
          bisaklát earns two, and a hand with an ambition earns one more. First
          to the target sweeps the pot.
        </Muted>
        <Toggle
          label="Play the jai alái"
          value={ruleset.jaiAlai.enabled}
          onChange={(next) => updateJaiAlai({ enabled: next })}
        />
        {ruleset.jaiAlai.enabled ? (
          <View style={{ gap: space.sm }}>
            <Choice
              label="Ante"
              value={ruleset.jaiAlai.ante}
              options={[0.25, 0.5, 1].map((n) => ({ value: n, label: n.toFixed(2) }))}
              onChange={(n) => updateJaiAlai({ ante: n })}
            />
            <Choice
              label="Markers to win"
              value={ruleset.jaiAlai.markersToWin}
              options={[
                { value: 5, label: '5 · jai alái' },
                { value: 10, label: '10 · kalembang' },
              ]}
              onChange={(n) => updateJaiAlai({ markersToWin: n })}
            />
            <Choice
              label="Most chips one hand can pay"
              value={ruleset.jaiAlai.maxPerHand}
              options={[
                { value: 2, label: '2 · the book' },
                { value: 3, label: '3' },
                { value: 0, label: 'no cap' },
              ]}
              onChange={(n) => updateJaiAlai({ maxPerHand: n })}
            />
            <Body>The majors</Body>
            <Muted style={{ fontSize: fontSize.small }}>
              A win carrying any of these earns the extra chip — two for the
              hand, the same as a bunot, and two is the ceiling even with a
              second major. All chow is a bonus in this book, not a major.
            </Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {MAJOR_CANDIDATES.map((candidate) => {
                const active = ruleset.jaiAlai.majors.includes(candidate.id);
                return (
                  <Pressable
                    key={candidate.id}
                    onPress={() =>
                      updateJaiAlai({
                        majors: active
                          ? ruleset.jaiAlai.majors.filter((id) => id !== candidate.id)
                          : [...ruleset.jaiAlai.majors, candidate.id],
                      })
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    style={{
                      paddingVertical: 9,
                      paddingHorizontal: space.md,
                      borderRadius: radius.pill,
                      backgroundColor: active ? palette.gold : 'rgba(255,255,255,0.07)',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: type.bodyMedium,
                        fontSize: fontSize.small,
                        color: active ? '#2A1D07' : palette.capiz,
                      }}
                    >
                      {candidate.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </Card>

      <Card>
        <Term>Flower bonus threshold</Term>
        <Muted style={{ fontSize: fontSize.small }}>
          How many flowers pay the collector bonus. Visayan tables switch it off.
          Sin Flores — being dealt none — is separate, below.
        </Muted>
        <Choice
          label=""
          value={ruleset.thirteenFlowersThreshold}
          options={[
            { value: 0, label: 'off' },
            { value: 10, label: '10' },
            { value: 13, label: '13' },
            { value: 16, label: '16' },
          ]}
          onChange={(n) => update({ thirteenFlowersThreshold: n })}
        />
      </Card>

      <Card>
        <Term>Bunot multiplier</Term>
        <Muted style={{ fontSize: fontSize.small }}>
          What a self-drawn win — or Rob the Kong — multiplies the whole payout by.
        </Muted>
        <Choice
          label=""
          value={ambitionValue(ruleset, 'bunot')}
          options={[2, 3].map((n) => ({ value: n, label: `×${n}` }))}
          onChange={(n) => setAmbition('bunot', n)}
        />
      </Card>

      <Card>
        <Term>Before the 5th</Term>
        <Muted style={{ fontSize: fontSize.small }}>
          Win inside this many discards and the hand pays extra.
        </Muted>
        <Choice
          label=""
          value={ruleset.quickWinDiscardLimit}
          options={[3, 5, 8].map((n) => ({ value: n, label: `${n} discards` }))}
          onChange={(n) => update({ quickWinDiscardLimit: n })}
        />
      </Card>

      <Card>
        <Term>Rounds per game</Term>
        <Choice
          label=""
          value={ruleset.roundsPerGame}
          options={[1, 2, 4].map((n) => ({ value: n, label: `${n}` }))}
          onChange={(n) => update({ roundsPerGame: n })}
        />
      </Card>

      <Term>Ambition values</Term>
      <Muted style={{ fontSize: fontSize.small }}>
        Set anything to zero to stop paying it at your table.
      </Muted>

      {AMBITIONS.filter((a) => a.kind !== 'multiplier').map((ambition) => (
        <Card key={ambition.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
            <Body style={{ flex: 1 }}>{ambition.label}</Body>
            <Body>{ambitionValue(ruleset, ambition.id).toFixed(2)}</Body>
          </View>
          <Muted style={{ fontSize: fontSize.small }}>{ambition.description}</Muted>
          {ambition.conflicts.length > 0 ? (
            <Muted style={{ fontSize: fontSize.small }}>
              Never scored with: {ambition.conflicts.join(', ')}
            </Muted>
          ) : null}
          <Choice
            label=""
            value={ambitionValue(ruleset, ambition.id)}
            options={valueChoices(ambition.defaultValue)}
            onChange={(value) => setAmbition(ambition.id, value)}
          />
        </Card>
      ))}
    </Screen>
  );
}

/**
 * Real tables disagree by a lot more than a little: the sources put escaléra
 * anywhere from 0.5 to 4× the base win, so the picker runs the whole spread.
 */
function valueChoices(base: number): { value: number; label: string }[] {
  const values = base >= 10 ? [0, 10, 20, 40] : [0, 0.25, 0.5, 1, 2, 4];
  return Array.from(new Set(values.concat(base))).map((value) => ({
    value,
    label: value === 0 ? 'off' : value.toFixed(2),
  }));
}
