/**
 * A physical tile.
 *
 * Every state is distinguishable without relying on colour — elevation,
 * outline and opacity all carry the signal — so the high-contrast and
 * colourblind paths still read correctly.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import type { Tile as TileModel } from '@bahay/engine';
import { colors, radius, type Palette } from '../theme/tokens';
import { TileFace } from './TileFace';

export const TILE_RATIO = 83 / 62; // height : width
/** The bevel along the bottom edge, which eats into the tile's content box. */
export const TILE_EDGE = 3;

export type TileState = {
  selected?: boolean;
  /** Legal to call — a soft gold pulse. */
  legal?: boolean;
  /** Discarded or otherwise out of play. */
  dead?: boolean;
  /** All four copies of the joker face shimmer along the top edge. */
  joker?: boolean;
  /** Just drawn: sits slightly apart from the rack. */
  drawn?: boolean;
  faceDown?: boolean;
};

type Props = TileState & {
  tile: TileModel;
  width: number;
  palette?: Palette;
  boldEngraving?: boolean;
  reducedMotion?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Tile({
  tile,
  width,
  palette = colors,
  boldEngraving = false,
  reducedMotion = false,
  selected,
  legal,
  dead,
  joker,
  drawn,
  faceDown,
  onPress,
  onLongPress,
  style,
  accessibilityLabel,
}: Props) {
  const height = Math.round(width * TILE_RATIO);
  const pulse = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (legal && !reducedMotion) {
      pulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 650 }), withTiming(0, { duration: 650 })),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(legal ? 1 : 0, { duration: 160 });
    }
    return () => cancelAnimation(pulse);
  }, [legal, reducedMotion, pulse]);

  useEffect(() => {
    lift.value = withTiming(selected ? 1 : 0, { duration: reducedMotion ? 0 : 160 });
  }, [selected, reducedMotion, lift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 * lift.value }],
    shadowOpacity: 0.35 + 0.25 * lift.value + 0.2 * pulse.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.6 * pulse.value }));

  const body = (
    <Animated.View
      style={[
        styles.tile,
        {
          width,
          height,
          borderRadius: radius.tile,
          backgroundColor: faceDown ? palette.tileBack : palette.tileFace,
          borderBottomColor: faceDown ? palette.tileBackDark : palette.tileShadow,
          opacity: dead ? 0.7 : 1,
        },
        selected && { borderColor: palette.gold, borderWidth: 2 },
        animatedStyle,
        style,
      ]}
    >
      {legal ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            { borderRadius: radius.tile + 2, borderColor: palette.goldGlow },
            glowStyle,
          ]}
        />
      ) : null}

      {faceDown ? (
        <View style={[styles.backInset, { borderColor: 'rgba(255,255,255,0.14)' }]} />
      ) : (
        <TileFace
          tile={tile}
          width={width}
          // The bevel is inside the box, so the face gets what is left.
          height={height - TILE_EDGE}
          palette={palette}
          bold={boldEngraving}
        />
      )}

      {joker && !faceDown ? (
        <View style={[styles.jokerBar, { backgroundColor: palette.goldGlow }]} />
      ) : null}
    </Animated.View>
  );

  const wrapper: ViewStyle | undefined = drawn ? { marginLeft: 12 } : undefined;

  if (!onPress && !onLongPress) return <View style={wrapper}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? describeTile(tile)}
      accessibilityState={{ selected: !!selected, disabled: !!dead }}
      style={wrapper}
    >
      {body}
    </Pressable>
  );
}

export function describeTile(tile: TileModel): string {
  if (tile.kind === 'flower') return `flower, ${tile.face}`;
  const names = { balls: 'bolá', sticks: 'kahoy', chars: 'letra' } as const;
  return `${tile.rank} ${names[tile.suit]}`;
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: TILE_EDGE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  glow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2.5,
  },
  backInset: {
    position: 'absolute',
    top: 6,
    left: 5,
    right: 5,
    bottom: 6,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  jokerBar: {
    position: 'absolute',
    top: 2,
    left: 6,
    right: 6,
    height: 3,
    borderRadius: 2,
    opacity: 0.9,
  },
});
