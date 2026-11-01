/**
 * The small shared vocabulary every screen is built from: black lacquer,
 * brass fittings, capiz-white type. Body text never goes below 16pt —
 * mahjong skews older.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  colors,
  onBrass,
  fontSize,
  highContrastColors,
  radius,
  space,
  type,
  type Palette,
} from '../theme/tokens';
import { useSettings } from '../store/settings';
import { useSvgIds } from '../lib/svgId';

export function usePalette(): Palette {
  const highContrast = useSettings((s) => s.highContrast);
  return highContrast ? highContrastColors : colors;
}

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const body = (
    <View
      style={[
        // Phone-width content, centred: in a desktop browser the menus read as
        // a column rather than buttons a metre wide.
        { padding: space.xl, gap: space.lg, flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
        style,
      ]}
    >
      {children}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.night }} edges={['top', 'bottom']}>
      <Backdrop />
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

type TextProps = {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

/**
 * The room the table sits in: black lacquer, lit warm from above, falling off
 * to near-black at the edges. Purely decorative, so it never takes a touch.
 */
export function Backdrop() {
  const palette = usePalette();
  const id = useSvgIds();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id('room')} cx="50%" cy="0%" rx="95%" ry="70%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={palette.narra} stopOpacity="0.55" />
            <Stop offset="0.5" stopColor={palette.lacquer} stopOpacity="1" />
            <Stop offset="1" stopColor={palette.night} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id('room')})`} />
      </Svg>
    </View>
  );
}

export function Display({ children, style }: TextProps) {
  const palette = usePalette();
  return (
    <Text
      style={[
        {
          fontFamily: type.display,
          fontSize: fontSize.display,
          color: palette.capiz,
          letterSpacing: -0.5,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Title({ children, style }: TextProps) {
  const palette = usePalette();
  return (
    <Text
      style={[{ fontFamily: type.displaySemi, fontSize: fontSize.title, color: palette.capiz }, style]}
    >
      {children}
    </Text>
  );
}

/** Labels and Filipino terms: small caps in brass, widely spaced. */
export function Term({ children, style }: TextProps) {
  const palette = usePalette();
  return (
    <Text
      style={[
        {
          fontFamily: type.label,
          fontSize: fontSize.micro,
          letterSpacing: 2.6,
          textTransform: 'uppercase',
          color: palette.gold,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, style, numberOfLines }: TextProps) {
  const palette = usePalette();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ fontFamily: type.body, fontSize: fontSize.body, color: palette.capiz }, style]}
    >
      {children}
    </Text>
  );
}

export function Muted({ children, style, numberOfLines }: TextProps) {
  const palette = usePalette();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontFamily: type.body, fontSize: fontSize.body, color: palette.capiz, opacity: 0.62 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const content = (
    <View
      style={[
        {
          backgroundColor: 'rgba(255,236,214,0.035)',
          borderColor: 'rgba(201,161,90,0.22)',
          borderWidth: 1,
          borderRadius: radius.card,
          padding: space.lg,
          gap: space.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  // Brass is a bevelled fitting: lit along the top edge, shadowed along the
  // bottom. Secondary is lacquer with a brass hairline; ghost is only a line.
  const look: ViewStyle =
    tone === 'primary'
      ? {
          backgroundColor: palette.gold,
          borderTopWidth: 1,
          borderTopColor: palette.goldGlow,
          borderBottomWidth: 3,
          borderBottomColor: palette.brassDark,
        }
      : tone === 'secondary'
        ? {
            backgroundColor: palette.lacquerLight,
            borderWidth: 1,
            borderColor: 'rgba(201,161,90,0.45)',
          }
        : { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(244,238,227,0.16)' };
  const color = tone === 'primary' ? onBrass : tone === 'secondary' ? palette.goldGlow : palette.capiz;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        look,
        {
          opacity: disabled ? 0.4 : 1,
          paddingVertical: 15,
          paddingHorizontal: space.xl,
          borderRadius: radius.card,
          alignItems: 'center',
          transform: [{ translateY: pressed && tone === 'primary' ? 1 : 0 }],
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: type.label,
          fontSize: fontSize.small,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={styles.row}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Body>{label}</Body>
        {description ? <Muted style={{ fontSize: fontSize.small }}>{description}</Muted> : null}
      </View>
      <View
        style={{
          width: 52,
          height: 30,
          borderRadius: radius.pill,
          padding: 3,
          backgroundColor: value ? palette.gold : 'rgba(244,238,227,0.14)',
          justifyContent: 'center',
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: value ? onBrass : palette.capiz,
          }}
        />
      </View>
    </Pressable>
  );
}

export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const palette = usePalette();
  return (
    <View style={{ gap: space.sm }}>
      <Body>{label}</Body>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: space.lg,
                borderRadius: radius.pill,
                backgroundColor: active ? palette.gold : 'rgba(255,236,214,0.05)',
                borderWidth: 1,
                borderColor: active ? palette.goldGlow : 'rgba(201,161,90,0.2)',
              }}
            >
              <Text
                style={{
                  fontFamily: type.bodyMedium,
                  fontSize: fontSize.body,
                  color: active ? onBrass : palette.capiz,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The way out of a screen: a quiet text link, not another big button. */
export function BackLink({ label = 'Back', onPress }: { label?: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: type.bodyMedium, fontSize: fontSize.small, color: palette.capiz, opacity: 0.85 }}>
        ‹ {label}
      </Text>
    </Pressable>
  );
}

/** A screen's heading: the title in Fraunces over a brass label. */
export function Heading({ kicker, title }: { kicker?: string; title: string }) {
  const palette = usePalette();
  return (
    <View style={{ gap: 4 }}>
      {kicker ? <Term>{kicker}</Term> : null}
      <Text style={{ fontFamily: type.display, fontSize: fontSize.title + 4, color: palette.capiz, letterSpacing: -0.3 }}>
        {title}
      </Text>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(201,161,90,0.22)' }} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.sm,
  },
});
