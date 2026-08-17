/**
 * The small shared vocabulary every screen is built from.
 * Body text never goes below 16pt — mahjong skews older.
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
import {
  colors,
  fontSize,
  highContrastColors,
  radius,
  space,
  type,
  type Palette,
} from '../theme/tokens';
import { useSettings } from '../store/settings';

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
    <View style={[{ padding: space.xl, gap: space.lg, flexGrow: 1 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.feltDeep }} edges={['top', 'bottom']}>
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

export function Display({ children, style }: TextProps) {
  const palette = usePalette();
  return (
    <Text
      style={[
        { fontFamily: type.display, fontSize: fontSize.display, color: palette.capiz },
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

/** Filipino terms: display face, letter-spaced, gold. */
export function Term({ children, style }: TextProps) {
  const palette = usePalette();
  return (
    <Text
      style={[
        {
          fontFamily: type.displaySemi,
          fontSize: fontSize.small,
          letterSpacing: 2.4,
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
          backgroundColor: 'rgba(0,0,0,0.22)',
          borderColor: 'rgba(255,255,255,0.08)',
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
  const background =
    tone === 'primary' ? palette.gold : tone === 'secondary' ? palette.felt : 'transparent';
  const color = tone === 'primary' ? '#2A1D07' : palette.capiz;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          paddingVertical: 15,
          paddingHorizontal: space.xl,
          borderRadius: radius.card,
          alignItems: 'center',
          borderWidth: tone === 'ghost' ? 1 : 0,
          borderColor: 'rgba(255,253,247,0.25)',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: type.displaySemi,
          fontSize: fontSize.body,
          letterSpacing: 0.6,
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
          backgroundColor: value ? palette.gold : 'rgba(255,253,247,0.16)',
          justifyContent: 'center',
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: value ? '#2A1D07' : palette.capiz,
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
                backgroundColor: active ? palette.gold : 'rgba(255,255,255,0.07)',
              }}
            >
              <Text
                style={{
                  fontFamily: type.bodyMedium,
                  fontSize: fontSize.body,
                  color: active ? '#2A1D07' : palette.capiz,
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

export function Divider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(212,162,76,0.22)' }} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.sm,
  },
});
