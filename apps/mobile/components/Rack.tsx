/**
 * The rack — the player's own tiles.
 *
 * Tap to select, tap again (or the confirm button) to discard: never a single
 * tap, because a mis-tapped discard is the single most infuriating misplay in
 * every existing app. Drag to reorder. Long-press to magnify the tile under the
 * thumb. Nothing here ever rearranges itself.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { Face, Tile as TileModel } from '@bahay/engine';
import { useSettings } from '../store/settings';
import { space } from '../theme/tokens';
import { Tile, TILE_RATIO } from './Tile';
import { usePalette } from './ui';

const OVERLAP = 0.84; // tiles sit 16% over their neighbour

type Props = {
  tiles: TileModel[];
  selectedTileId: string | null;
  justDrewId: string | null;
  joker: Face | null;
  onSelect: (tileId: string) => void;
  onMove: (from: number, to: number) => void;
  onMagnify: (tile: TileModel | null) => void;
  disabled?: boolean;
};

export function Rack({
  tiles,
  selectedTileId,
  justDrewId,
  joker,
  onSelect,
  onMove,
  onMagnify,
  disabled,
}: Props) {
  const { width } = useWindowDimensions();
  const palette = usePalette();
  const { tileScale, reducedMotion, highContrast, haptics } = useSettings();
  const [dragging, setDragging] = useState<number | null>(null);

  const count = Math.max(tiles.length, 1);
  const available = width - space.lg * 2;
  const step = Math.min(46, available / (count * OVERLAP + (1 - OVERLAP)));
  const tileWidth = Math.max(20, Math.round(step / OVERLAP) * tileScale);
  const stepWidth = Math.round(tileWidth * OVERLAP);
  const height = Math.round(tileWidth * TILE_RATIO) + 18;

  const isJoker = useCallback(
    (tile: TileModel) =>
      !!joker && tile.kind === 'suited' && tile.suit === joker.suit && tile.rank === joker.rank,
    [joker],
  );

  const handleSelect = useCallback(
    (tile: TileModel) => {
      if (disabled) return;
      if (haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(tile.id);
    },
    [disabled, haptics, onSelect],
  );

  return (
    <View style={[styles.rack, { height }]}>
      {tiles.map((tile, index) => (
        <RackTile
          key={tile.id}
          tile={tile}
          index={index}
          count={tiles.length}
          width={tileWidth}
          step={stepWidth}
          palette={palette}
          selected={tile.id === selectedTileId}
          drawn={tile.id === justDrewId}
          joker={isJoker(tile)}
          boldEngraving={highContrast}
          reducedMotion={reducedMotion}
          dragging={dragging === index}
          onDragStart={() => setDragging(index)}
          onDragEnd={() => setDragging(null)}
          onSelect={() => handleSelect(tile)}
          onMagnify={onMagnify}
          onMove={onMove}
        />
      ))}
    </View>
  );
}

type RackTileProps = {
  tile: TileModel;
  index: number;
  count: number;
  width: number;
  step: number;
  palette: ReturnType<typeof usePalette>;
  selected: boolean;
  drawn: boolean;
  joker: boolean;
  boldEngraving: boolean;
  reducedMotion: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSelect: () => void;
  onMagnify: (tile: TileModel | null) => void;
  onMove: (from: number, to: number) => void;
};

function RackTile({
  tile,
  index,
  count,
  width,
  step,
  palette,
  selected,
  drawn,
  joker,
  boldEngraving,
  reducedMotion,
  dragging,
  onDragStart,
  onDragEnd,
  onSelect,
  onMagnify,
  onMove,
}: RackTileProps) {
  const offsetX = useSharedValue(0);
  const lifted = useSharedValue(0);

  const drop = useCallback(
    (slots: number) => {
      const target = Math.min(count - 1, Math.max(0, index + slots));
      if (target !== index) onMove(index, target);
      onDragEnd();
    },
    [count, index, onDragEnd, onMove],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(180)
        .onStart(() => {
          lifted.value = withTiming(1, { duration: 120 });
          runOnJS(onDragStart)();
        })
        .onUpdate((event) => {
          offsetX.value = event.translationX;
        })
        .onEnd((event) => {
          const slots = Math.round(event.translationX / step);
          offsetX.value = withTiming(0, { duration: 140 });
          lifted.value = withTiming(0, { duration: 140 });
          runOnJS(drop)(slots);
        }),
    [drop, lifted, offsetX, onDragStart, step],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(300)
        .onEnd((_event, success) => {
          if (success) runOnJS(onSelect)();
        }),
    [onSelect],
  );

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(320)
        .onStart(() => runOnJS(onMagnify)(tile))
        .onEnd(() => runOnJS(onMagnify)(null)),
    [onMagnify, tile],
  );

  const composed = useMemo(
    () => Gesture.Simultaneous(Gesture.Exclusive(pan, longPress), tap),
    [longPress, pan, tap],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: -6 * lifted.value }],
    zIndex: dragging ? 50 : index,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          { marginLeft: index === 0 ? 0 : step - width, marginTop: 8 },
          drawn ? { marginLeft: (index === 0 ? 0 : step - width) + 14 } : null,
          style,
        ]}
      >
        <Tile
          tile={tile}
          width={width}
          palette={palette}
          selected={selected}
          joker={joker}
          boldEngraving={boldEngraving}
          reducedMotion={reducedMotion}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  rack: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
});
