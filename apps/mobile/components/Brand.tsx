/**
 * The Báhay marks.
 *
 * The emblem is the name, drawn: a mahjong tile under the pitched roof of a
 * bahay kubo, with a single red eye on its face — "five báhay and an eye",
 * the shape of every winning hand, reduced to one house and one eye.
 */

import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors, type, type Palette } from '../theme/tokens';
import { useSvgIds } from '../lib/svgId';

export function Emblem({ size, palette = colors }: { size: number; palette?: Palette }) {
  // Drawn on a 100 × 112 canvas.
  const h = size * 1.12;
  const id = useSvgIds();
  return (
    <Svg width={size} height={h} viewBox="0 0 100 112" accessibilityLabel="Báhay">
      <Defs>
        <LinearGradient id={id('emb-face')} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFEF9" />
          <Stop offset="1" stopColor="#E9DFC7" />
        </LinearGradient>
        <LinearGradient id={id('emb-jade')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.tileBackLight} />
          <Stop offset="1" stopColor={palette.tileBackDark} />
        </LinearGradient>
        <LinearGradient id={id('emb-roof')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.narraLight} />
          <Stop offset="1" stopColor={palette.narraDark} />
        </LinearGradient>
        <LinearGradient id={id('emb-brass')} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={palette.goldGlow} />
          <Stop offset="1" stopColor={palette.brassDark} />
        </LinearGradient>
      </Defs>

      {/* The tile: jade back, ivory face. */}
      <Rect x={20} y={40} width={60} height={70} rx={9} fill={`url(#${id('emb-jade')})`} />
      <Rect x={20} y={40} width={60} height={61} rx={9} fill={`url(#${id('emb-face')})`} />
      <Rect
        x={21}
        y={41}
        width={58}
        height={59}
        rx={8}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.8}
        strokeWidth={1.2}
      />

      {/* The eye: one red dot, carved. */}
      <G>
        <Circle cx={50.6} cy={71.6} r={13} fill="none" stroke="#FFFFFF" strokeWidth={4.5} opacity={0.9} />
        <Circle cx={50} cy={71} r={13} fill="none" stroke={palette.vermilion} strokeWidth={4.5} />
        <Circle cx={50} cy={71} r={5.2} fill={palette.vermilion} />
      </G>

      {/* The roof of a bahay kubo, with a brass ridge. */}
      <Path d="M2 48 L50 5 L98 48 L80 48 L50 21 L20 48 Z" fill={`url(#${id('emb-roof')})`} />
      <Path d="M50 5 L98 48" stroke={`url(#${id('emb-brass')})`} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M50 5 L2 48" stroke={`url(#${id('emb-brass')})`} strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={50} cy={5.5} r={3.4} fill={`url(#${id('emb-brass')})`} />
    </Svg>
  );
}

/** The name, set in Fraunces, with the descriptor between brass rules. */
export function Wordmark({
  size = 52,
  palette = colors,
  descriptor = 'Filipino Mahjong',
}: {
  size?: number;
  palette?: Palette;
  descriptor?: string | null;
}) {
  return (
    <View style={{ alignItems: 'center', gap: size * 0.08 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: type.display,
          fontSize: size,
          lineHeight: size * 1.1,
          letterSpacing: -size * 0.01,
          color: palette.capiz,
        }}
      >
        Báhay
      </Text>
      {descriptor ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 26, height: 1, backgroundColor: palette.gold, opacity: 0.8 }} />
          <Text
            style={{
              fontFamily: type.label,
              fontSize: Math.max(10, size * 0.21),
              letterSpacing: 3.2,
              textTransform: 'uppercase',
              color: palette.gold,
            }}
          >
            {descriptor}
          </Text>
          <View style={{ width: 26, height: 1, backgroundColor: palette.gold, opacity: 0.8 }} />
        </View>
      ) : null}
    </View>
  );
}
