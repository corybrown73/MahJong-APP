/**
 * A physical tile, with its states.
 *
 * Every state is distinguishable without relying on colour — elevation,
 * outline and opacity all carry the signal — so the high-contrast and
 * colourblind paths still read correctly.
 */

import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { Tile as TileModel } from '@bahay/engine';
import { colors, type Palette } from '../theme/tokens';
import { TileArt } from './TileFace';

/** Height : width, including the band of thickness under the face. */
export const TILE_RATIO = 1.46;

export type TileState = {
  selected?: boolean;
  /** Legal to call — a soft brass pulse. */
  legal?: boolean;
  /** Discarded or otherwise out of play. */
  dead?: boolean;
  /** All four copies of the joker face carry a brass jewel in the corner. */
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
  /** Drop the cast shadow — for tiles lying flat and small on the felt. */
  flat?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export const Tile = memo(function Tile({
  tile,
  width,
  palette = colors,
  boldEngraving = false,
  reducedMotion = false,
  flat = false,
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
    transform: [{ translateY: -Math.round(width * 0.38) * lift.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.6 * pulse.value }));

  const body = (
    <Animated.View
      style={[
        {
          width,
          height,
          opacity: dead ? 0.72 : 1,
          borderRadius: width * 0.14,
        },
        flat ? styles.flatShadow : styles.shadow,
        animatedStyle,
        style,
      ]}
    >
      {legal ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            { borderRadius: width * 0.18, borderColor: palette.goldGlow },
            glowStyle,
          ]}
        />
      ) : null}

      <TileArt
        tile={tile}
        width={width}
        height={height}
        palette={palette}
        bold={boldEngraving}
        faceDown={faceDown}
        highlight={selected}
      />

      {joker && !faceDown ? (
        <View
          pointerEvents="none"
          style={[
            styles.jewel,
            {
              width: Math.max(5, width * 0.2),
              height: Math.max(5, width * 0.2),
              borderRadius: width,
              top: width * 0.1,
              right: width * 0.1,
              backgroundColor: palette.gold,
              borderColor: palette.goldGlow,
            },
          ]}
        />
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
});

export function describeTile(tile: TileModel): string {
  if (tile.kind === 'flower') return `flower, ${tile.face}`;
  const names = { balls: 'bolá', sticks: 'kahoy', chars: 'letra' } as const;
  return `${tile.rank} ${names[tile.suit]}`;
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 4,
  },
  flatShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 1.5,
    elevation: 1,
  },
  glow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2.5,
  },
  jewel: {
    position: 'absolute',
    borderWidth: 1,
    shadowColor: '#F0C97A',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
