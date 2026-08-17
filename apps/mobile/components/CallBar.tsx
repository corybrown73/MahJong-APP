/**
 * The call bar is permanent.
 *
 * Buttons are dimmed when the call is illegal and gold when it is not, so the
 * player never has to guess or go looking. During a claim window a thin line
 * drains across the bar. Long-pressing a lit button explains what the call
 * would do with the player's actual tiles.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { CallType } from '@bahay/engine';
import { fontSize, radius, space, type } from '../theme/tokens';
import { usePalette } from './ui';

export type CallOption = {
  call: CallType;
  tileIds: string[];
  describe: string;
};

const ORDER: CallType[] = ['chow', 'pung', 'kang', 'todas'];
/**
 * The house book's words: pong, kong, and "declare mahjongg". The engine's
 * internal names stay chow/pung/kang/todas; only the table speaks.
 */
const LABELS: Record<CallType, string> = {
  chow: 'CHOW',
  pung: 'PONG',
  kang: 'KONG',
  todas: 'MAHJONGG',
};

type Props = {
  options: CallOption[];
  /** 0 to 1 — how much of the claim window is left. Null when no window is open. */
  windowProgress: number | null;
  onCall: (option: CallOption) => void;
  onPass: () => void;
  onExplain: (text: string) => void;
};

export function CallBar({ options, windowProgress, onCall, onPass, onExplain }: Props) {
  const palette = usePalette();
  const progress = useSharedValue(1);
  progress.value = withTiming(windowProgress ?? 0, { duration: 120 });

  const drain = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));

  const windowOpen = windowProgress !== null;

  return (
    <View style={[styles.bar, { backgroundColor: 'rgba(0,0,0,0.26)' }]}>
      {windowOpen ? (
        <Animated.View style={[styles.drain, { backgroundColor: palette.goldGlow }, drain]} />
      ) : null}

      <View style={styles.row}>
        {ORDER.map((call) => {
          const option = options.find((o) => o.call === call);
          const enabled = !!option;
          return (
            <Pressable
              key={call}
              disabled={!enabled}
              onPress={() => option && onCall(option)}
              onLongPress={() => option && onExplain(option.describe)}
              accessibilityRole="button"
              accessibilityState={{ disabled: !enabled }}
              accessibilityLabel={option ? option.describe : `${LABELS[call]} not available`}
              style={[
                styles.button,
                enabled
                  ? { backgroundColor: palette.gold }
                  : { backgroundColor: 'rgba(255,255,255,0.05)' },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  { color: enabled ? '#2A1D07' : 'rgba(255,253,247,0.28)' },
                ]}
              >
                {LABELS[call]}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          disabled={!windowOpen}
          onPress={onPass}
          accessibilityRole="button"
          accessibilityLabel="Pass on this discard"
          style={[
            styles.button,
            styles.pass,
            { backgroundColor: windowOpen ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)' },
          ]}
        >
          <Text
            style={[
              styles.label,
              { color: windowOpen ? 'rgba(255,253,247,0.8)' : 'rgba(255,253,247,0.28)' },
            ]}
          >
            PASS
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingVertical: space.sm, paddingHorizontal: space.md, gap: space.sm },
  drain: { height: 2, borderRadius: 2, marginBottom: 2 },
  row: { flexDirection: 'row', gap: 6 },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.tile + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pass: { flex: 0.7 },
  label: {
    fontFamily: type.displaySemi,
    fontSize: fontSize.micro,
    letterSpacing: 1.4,
  },
});
