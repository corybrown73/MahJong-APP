/**
 * Every call is announced, animated and briefly held.
 *
 * This is the fix for the loudest complaint about every competitor — "the
 * computer players move so fast you can't even follow what's going on."
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { fontSize, motion, space, speedMultiplier, type } from '../theme/tokens';
import { useSettings } from '../store/settings';
import type { Banner } from '../store/game';
import { usePalette } from './ui';

export function CallBanner({
  banner,
  who,
  onDone,
}: {
  banner: Banner | null;
  who: string;
  onDone: () => void;
}) {
  const palette = usePalette();
  const { speed, reducedMotion } = useSettings();
  const shown = useSharedValue(0);

  useEffect(() => {
    const factor = speedMultiplier[speed];
    if (!banner) {
      shown.value = withTiming(0, { duration: reducedMotion ? 80 : motion.bannerOut * factor });
      return;
    }
    shown.value = withTiming(1, { duration: reducedMotion ? 80 : motion.bannerIn * factor });
    // In, hold, out — then release so the next call gets a fresh banner.
    const id = setTimeout(
      onDone,
      (motion.bannerIn + motion.bannerHold + motion.bannerOut) * factor,
    );
    return () => clearTimeout(id);
  }, [banner, onDone, reducedMotion, shown, speed]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: reducedMotion ? [] : [{ scale: 0.94 + 0.06 * shown.value }],
  }));

  if (!banner) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View style={[styles.banner, { backgroundColor: palette.gold }, style]}>
        <Text style={styles.who}>{who.toUpperCase()} CALLS</Text>
        <Text style={styles.what}>{spaced(banner.headline)}</Text>
        <Text style={styles.detail}>{banner.detail}</Text>
      </Animated.View>
    </View>
  );
}

function spaced(text: string): string {
  return text.split('').join(' ');
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  banner: {
    paddingVertical: space.lg,
    paddingHorizontal: space.xxl,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  who: {
    fontFamily: type.displaySemi,
    fontSize: fontSize.micro,
    letterSpacing: 2.4,
    color: 'rgba(42,29,7,0.7)',
  },
  what: {
    fontFamily: type.display,
    fontSize: fontSize.title,
    letterSpacing: 3,
    color: '#2A1D07',
  },
  detail: { fontFamily: type.body, fontSize: fontSize.small, color: 'rgba(42,29,7,0.78)' },
});
