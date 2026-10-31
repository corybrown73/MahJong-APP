/**
 * Choosing a chair.
 *
 * The lobby is the room before the hand: the same automatic table, seen from
 * above, with four chairs drawn up to it. Tap a chair to choose it. Whoever is
 * sitting in each one is written on the cushion; the empty ones wait with a
 * brass outline, and yours glows.
 *
 * Chairs keep a fixed place — seat 0 at the bottom, the rest counterclockwise
 * — so the picture never spins round when somebody moves.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { SeatId } from '@bahay/engine';
import type { SeatView } from '@bahay/room';
import { type, type Palette } from '../theme/tokens';
import { useSvgIds } from '../lib/svgId';

const WINDS = ['東', '南', '西', '北'] as const;
const WIND_NAMES = ['East', 'South', 'West', 'North'] as const;
const SIDES = ['bottom', 'right', 'top', 'left'] as const;
type Side = (typeof SIDES)[number];

type Props = {
  width: number;
  seats: SeatView[];
  selected: SeatId | null;
  onSelect: (seat: SeatId) => void;
  palette: Palette;
};

export function ChairPicker({ width, seats, selected, onSelect, palette }: Props) {
  const table = Math.round(width * 0.5);
  const chair = Math.round(width * 0.24);
  const offset = (width - table) / 2;

  // Room above the top chair and below the bottom one for their name tags.
  const tagRoom = 34;
  return (
    <View style={{ width, height: width + tagRoom * 2, paddingTop: tagRoom }}>
      <View style={{ width, height: width }}>
      {/* A small automatic table in the middle of the room. */}
      <View style={{ position: 'absolute', left: offset, top: offset }}>
        <IdleTable size={table} palette={palette} />
      </View>

      {seats.map((seat) => {
        const side = SIDES[seat.seat];
        const gap = width * 0.025;
        const pos =
          side === 'bottom'
            ? { left: (width - chair) / 2, top: offset + table + gap }
            : side === 'top'
              ? { left: (width - chair) / 2, top: offset - chair - gap }
              : side === 'left'
                ? { left: offset - chair - gap, top: (width - chair) / 2 }
                : { left: offset + table + gap, top: (width - chair) / 2 };
        return (
          <Chair
            key={seat.seat}
            seat={seat}
            side={side}
            size={chair}
            style={pos}
            selected={selected === seat.seat}
            onPress={() => onSelect(seat.seat as SeatId)}
            palette={palette}
          />
        );
      })}
      </View>
    </View>
  );
}

function Chair({
  seat,
  side,
  size,
  style,
  selected,
  onPress,
  palette,
}: {
  seat: SeatView;
  side: Side;
  size: number;
  style: { left: number; top: number };
  selected: boolean;
  onPress: () => void;
  palette: Palette;
}) {
  const empty = seat.kind === 'open';
  const id = useSvgIds();
  const house = seat.kind === 'ai';
  const rotate = { bottom: 0, left: 90, top: 180, right: 270 }[side];
  // Velvet: emerald for you, oxblood for family, smoke for the house.
  const cushion = seat.isYou ? '#1C6B57' : house ? '#3A332E' : '#6A1F24';
  const cushionLight = seat.isYou ? '#2E8F76' : house ? '#544A43' : '#8E2E33';
  const s = 100; // drawn on a 100-unit square, scaled to `size`
  const status = empty
    ? 'Open chair'
    : seat.isYou
      ? 'Your chair'
      : house
        ? 'The house'
        : seat.connected
          ? 'Seated'
          : 'Seat held';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${WIND_NAMES[seat.seat]} chair. ${empty ? 'Empty' : seat.name}. ${status}${seat.isHost ? ', host' : ''}`}
      style={[{ position: 'absolute', width: size, height: size }, style]}
    >
      <View style={{ width: size, height: size, transform: [{ rotate: `${rotate}deg` }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${s} ${s}`}>
          <Defs>
            <LinearGradient id={id('chair-wood')} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.narraLight} />
              <Stop offset="1" stopColor={palette.narraDark} />
            </LinearGradient>
            <RadialGradient id={id('cushion')} cx="45%" cy="40%" rx="65%" ry="65%">
              <Stop offset="0" stopColor={cushionLight} />
              <Stop offset="1" stopColor={cushion} />
            </RadialGradient>
          </Defs>

          {selected ? (
            <Rect x={2} y={2} width={96} height={96} rx={22} fill="none" stroke={palette.goldGlow} strokeWidth={3} />
          ) : null}

          {/* The back, on the side away from the table. */}
          <Path
            d="M12 74 Q12 96 50 96 Q88 96 88 74 L88 70 L12 70 Z"
            fill={`url(#${id('chair-wood')})`}
            opacity={empty ? 0.45 : 1}
          />
          {/* Arms */}
          <Rect x={8} y={22} width={14} height={58} rx={7} fill={`url(#${id('chair-wood')})`} opacity={empty ? 0.45 : 1} />
          <Rect x={78} y={22} width={14} height={58} rx={7} fill={`url(#${id('chair-wood')})`} opacity={empty ? 0.45 : 1} />
          {/* Seat */}
          {empty ? (
            <Rect
              x={22}
              y={14}
              width={56}
              height={58}
              rx={12}
              fill="rgba(255,236,214,0.04)"
              stroke={palette.gold}
              strokeWidth={2}
              strokeDasharray="6 5"
            />
          ) : (
            <>
              <Rect x={22} y={14} width={56} height={58} rx={12} fill={`url(#${id('cushion')})`} />
              <Rect x={26} y={18} width={48} height={50} rx={10} fill="none" stroke="#000" strokeOpacity={0.18} strokeWidth={1.5} />
              <Circle cx={50} cy={43} r={2} fill="#000" opacity={0.25} />
            </>
          )}
        </Svg>
      </View>

      {/* Words stay upright whatever way the chair faces. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.label]}>
        {empty ? (
          <Text allowFontScaling={false} style={[styles.sit, { color: palette.goldGlow }]}>
            SIT
          </Text>
        ) : (
          <Text
            allowFontScaling={false}
            style={[styles.initial, { color: palette.capiz, fontSize: size * 0.3 }]}
          >
            {seat.name.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.tag,
          side === 'top' ? { bottom: size + 2 } : { top: size + 2 },
          { width: size * 1.6, left: -size * 0.3 },
        ]}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.tagName, { color: seat.isYou ? palette.goldGlow : palette.capiz }]}
        >
          {empty ? WIND_NAMES[seat.seat] : seat.isYou ? 'You' : seat.name}
          {seat.isHost ? ' ★' : ''}
        </Text>
        <Text allowFontScaling={false} style={[styles.tagWind, { color: palette.gold }]}>
          {WINDS[seat.seat]} · {status}
        </Text>
      </View>
    </Pressable>
  );
}

/** The table on its own, before anyone has rolled. */
export function IdleTable({ size, palette }: { size: number; palette: Palette }) {
  const id = useSvgIds();
  const rim = size * 0.07;
  const consoleSize = size * 0.34;
  const c = (size - consoleSize) / 2;
  return (
    <View style={[styles.tableShadow, { width: size, height: size, borderRadius: size * 0.09 }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={id('idle-narra')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.narraLight} />
            <Stop offset="0.5" stopColor={palette.narra} />
            <Stop offset="1" stopColor={palette.narraDark} />
          </LinearGradient>
          <RadialGradient id={id('idle-felt')} cx="50%" cy="45%" rx="60%" ry="60%">
            <Stop offset="0" stopColor={palette.feltLight} />
            <Stop offset="1" stopColor={palette.feltDeep} />
          </RadialGradient>
          <LinearGradient id={id('idle-brass')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.goldGlow} />
            <Stop offset="1" stopColor={palette.brassDark} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} rx={size * 0.09} fill={`url(#${id('idle-narra')})`} />
        <Rect
          x={rim * 0.5}
          y={rim * 0.5}
          width={size - rim}
          height={size - rim}
          rx={size * 0.08}
          fill="none"
          stroke={palette.gold}
          strokeOpacity={0.7}
          strokeWidth={1}
        />
        <Rect x={rim} y={rim} width={size - rim * 2} height={size - rim * 2} rx={size * 0.05} fill={`url(#${id('idle-felt')})`} />
        <Rect x={c} y={c} width={consoleSize} height={consoleSize} rx={consoleSize * 0.18} fill={`url(#${id('idle-brass')})`} />
        <Rect x={c + 2} y={c + 2} width={consoleSize - 4} height={consoleSize - 4} rx={consoleSize * 0.16} fill="#0E0B09" />
        <Circle cx={size / 2} cy={size / 2} r={consoleSize * 0.26} fill={`url(#${id('idle-brass')})`} />
        <Circle cx={size / 2} cy={size / 2} r={consoleSize * 0.23} fill="#0A1311" />
        <Circle cx={size / 2 - consoleSize * 0.06} cy={size / 2 - consoleSize * 0.07} r={consoleSize * 0.08} fill="#FFFFFF" opacity={0.18} />
      </Svg>
      {/* Each side's wind, facing its chair. */}
      {SIDES.map((side, seat) => {
        const rotate = { bottom: '0deg', right: '-90deg', top: '180deg', left: '90deg' }[side];
        const inset = c + consoleSize * 0.04;
        const pos =
          side === 'bottom'
            ? { left: 0, right: 0, bottom: inset }
            : side === 'top'
              ? { left: 0, right: 0, top: inset }
              : side === 'left'
                ? { top: 0, bottom: 0, left: inset }
                : { top: 0, bottom: 0, right: inset };
        return (
          <View key={side} pointerEvents="none" style={[styles.wind, pos]}>
            <Text
              allowFontScaling={false}
              style={{
                fontSize: consoleSize * 0.16,
                color: seat === 0 ? palette.led : 'rgba(244,238,227,0.4)',
                fontWeight: '700',
                transform: [{ rotate }],
              }}
            >
              {WINDS[seat]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { alignItems: 'center', justifyContent: 'center' },
  sit: { fontFamily: type.label, fontSize: 11, letterSpacing: 2 },
  initial: { fontFamily: type.display },
  tag: { position: 'absolute', alignItems: 'center' },
  tagName: { fontFamily: type.label, fontSize: 12, letterSpacing: 0.4 },
  tagWind: { fontFamily: type.body, fontSize: 10, opacity: 0.85 },
  wind: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  tableShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
});

