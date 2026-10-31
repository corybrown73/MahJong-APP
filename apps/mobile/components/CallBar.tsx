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
import { fontSize, onBrass, radius, space, type } from '../theme/tokens';
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
    <View style={styles.bar}>
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
                call === 'todas' ? { flex: 1.35 } : null,
                enabled
                  ? {
                      backgroundColor: palette.gold,
                      borderTopWidth: 1,
                      borderTopColor: palette.goldGlow,
                      borderBottomWidth: 3,
                      borderBottomColor: palette.brassDark,
                    }
                  : styles.idle,
              ]}
            >
              <Text
                style={[
                  styles.label,
                  { color: enabled ? onBrass : 'rgba(244,238,227,0.3)' },
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
            windowOpen
              ? { backgroundColor: palette.lacquerLight, borderWidth: 1, borderColor: palette.gold }
              : styles.idle,
          ]}
        >
          <Text
            style={[
              styles.label,
              { color: windowOpen ? palette.goldGlow : 'rgba(244,238,227,0.3)' },
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
  bar: { paddingTop: space.xs, paddingHorizontal: space.md, gap: space.xs },
  drain: { height: 2, borderRadius: 2, marginBottom: 2 },
  idle: {
    backgroundColor: 'rgba(255,236,214,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(201,161,90,0.16)',
  },
  row: { flexDirection: 'row', gap: 6 },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.card - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pass: { flex: 0.7 },
  label: {
    fontFamily: type.label,
    fontSize: fontSize.micro,
    letterSpacing: 1.6,
  },
});
