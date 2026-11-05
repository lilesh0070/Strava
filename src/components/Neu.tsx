// Neumorphic building blocks. Presses ease in and out with a native-driven spring, so every tap has a
// little weight instead of a one-frame style swap.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../lib/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Spring-driven press scale, shared by every pressable surface. */
function usePressScale(to = 0.96) {
  const [scale] = useState(() => new Animated.Value(1));
  const press = (down: boolean) =>
    Animated.spring(scale, { toValue: down ? to : 1, useNativeDriver: true, friction: 6, tension: 160 }).start();
  return { scale, onPressIn: () => press(true), onPressOut: () => press(false) };
}

/** Raised (or inset) soft surface. */
export function NeuCard({ children, style, inset, radius = 22, padding = 16 }: {
  children?: ReactNode; style?: StyleProp<ViewStyle>; inset?: boolean; radius?: number; padding?: number;
}) {
  const { C, S } = useTheme();
  return (
    <View style={[{ backgroundColor: C.bg, borderRadius: radius, padding, boxShadow: inset ? S.inset : S.raised }, style]}>
      {children}
    </View>
  );
}

/** Pill / rounded button that sinks in while pressed or when selected. */
export function NeuButton({ label, icon, onPress, selected, accent, style, small, disabled, busy, accessibilityLabel }: {
  label?: string; icon?: IconName; onPress?: () => void; selected?: boolean; accent?: boolean;
  style?: StyleProp<ViewStyle>; small?: boolean; disabled?: boolean; busy?: boolean; accessibilityLabel?: string;
}) {
  const { C, S } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(0.97);
  const fg = accent ? C.accentText : selected ? C.accentInk : C.text;
  const off = disabled || busy;
  return (
    <Pressable
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected, disabled: !!off, busy: !!busy }}
      hitSlop={small ? { top: 6, bottom: 6, left: 4, right: 4 } : undefined}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => { Haptics.selectionAsync().catch(() => undefined); onPress?.(); }}
      style={style}
    >
      {({ pressed }) => (
        <Animated.View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          paddingHorizontal: small ? 14 : 20, paddingVertical: small ? 9 : 14, borderRadius: 999,
          backgroundColor: accent ? C.accent : C.bg,
          boxShadow: pressed || selected ? (small ? S.insetSm : S.inset) : accent ? S.glow : small ? S.raisedSm : S.raised,
          opacity: disabled ? 0.5 : 1, transform: [{ scale }],
        }}>
          {busy ? <ActivityIndicator size="small" color={fg} />
            : icon ? <MaterialCommunityIcons name={icon} size={small ? 16 : 20} color={fg} /> : null}
          {label ? <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 15 }} maxFontSizeMultiplier={1.3}>{label}</Text> : null}
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Round icon button, e.g. the settings cog or the record controls. */
export function NeuIconButton({ icon, onPress, onLongPress, delayLongPress, size = 44, accent, color, selected, disabled, busy, accessibilityLabel, accessibilityHint }: {
  icon: IconName; onPress?: () => void; onLongPress?: () => void; delayLongPress?: number; size?: number; accent?: boolean; color?: string;
  selected?: boolean; disabled?: boolean; busy?: boolean; accessibilityLabel: string; accessibilityHint?: string;
}) {
  const { C, S } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(0.93);
  const off = disabled || busy;
  const fg = color ?? (accent ? C.accentText : C.text);
  return (
    <Pressable
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: !!selected, disabled: !!off, busy: !!busy }}
      hitSlop={size < 44 ? 10 : 6}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPress={() => { Haptics.selectionAsync().catch(() => undefined); onPress?.(); }}
    >
      {({ pressed }) => (
        <Animated.View style={{
          width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
          backgroundColor: accent ? C.accent : C.bg,
          boxShadow: pressed || selected ? S.inset : accent ? S.glow : size > 56 ? S.raised : S.raisedSm,
          opacity: disabled ? 0.5 : 1, transform: [{ scale }],
        }}>
          {busy ? <ActivityIndicator size={size > 56 ? 'large' : 'small'} color={fg} />
            : <MaterialCommunityIcons name={icon} size={size * 0.45} color={fg} />}
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Inset track switch; the thumb slides with a spring. */
export function NeuSwitch({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel: string }) {
  const { C, S } = useTheme();
  const [x] = useState(() => new Animated.Value(value ? 26 : 0));
  useEffect(() => {
    Animated.spring(x, { toValue: value ? 26 : 0, useNativeDriver: true, friction: 7, tension: 120 }).start();
  }, [value, x]);
  return (
    <Pressable
      accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={() => { Haptics.selectionAsync().catch(() => undefined); onValueChange(!value); }}
      style={{ width: 56, height: 30, borderRadius: 15, backgroundColor: C.bg, boxShadow: S.insetSm, padding: 4 }}
    >
      <Animated.View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: value ? C.accent : C.bg, boxShadow: S.raisedSm,
        transform: [{ translateX: x }] }} />
    </Pressable>
  );
}

/** Segmented control inside an inset track. */
export function NeuSegmented<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void;
}) {
  const { C, S } = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderRadius: 999, padding: 5, backgroundColor: C.bg, boxShadow: S.insetSm, gap: 4 }}>
      {options.map((o) => {
        const sel = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="button" accessibilityState={{ selected: sel }} hitSlop={{ top: 6, bottom: 6 }}
            onPress={() => { Haptics.selectionAsync().catch(() => undefined); onChange(o.key); }}
            style={{ flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 9,
              borderRadius: 999, backgroundColor: C.bg, boxShadow: sel ? S.raisedSm : undefined }}>
            {o.icon ? <MaterialCommunityIcons name={o.icon} size={16} color={sel ? C.accentInk : C.muted} /> : null}
            <Text style={{ color: sel ? C.accentInk : C.muted, fontWeight: '700', fontSize: 13 }} maxFontSizeMultiplier={1.3}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Rounded-square "well" holding an accent icon (as used in list tiles). */
export function IconWell({ icon, size = 48, color }: { icon: IconName; size?: number; color?: string }) {
  const { C, S } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.36, alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.bg, boxShadow: S.well }}>
      <MaterialCommunityIcons name={icon} size={size * 0.46} color={color ?? C.accent} />
    </View>
  );
}

/** Tile: icon well + title + subtitle, like a settings or category card. `selected` keeps it sunk in (a chosen option). */
export function NeuTile({ icon, title, subtitle, onPress, right, style, selected }: {
  icon: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; style?: StyleProp<ViewStyle>; selected?: boolean;
}) {
  const { C, S } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(0.985);
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected != null ? { selected } : undefined}
      onPressIn={onPress ? onPressIn : undefined}
      onPressOut={onPress ? onPressOut : undefined}
      onPress={() => { Haptics.selectionAsync().catch(() => undefined); onPress?.(); }}
      style={style}
    >
      {({ pressed }) => (
        <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 26,
          backgroundColor: C.bg, boxShadow: pressed || selected ? S.inset : S.raised, transform: [{ scale }] }}>
          <IconWell icon={icon} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: selected ? C.accentInk : C.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{subtitle}</Text> : null}
          </View>
          {right}
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Inset progress bar; the fill eases to its new value. */
export function NeuProgress({ value }: { value: number }) {
  const { C, S } = useTheme();
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const [w] = useState(() => new Animated.Value(v));
  useEffect(() => {
    Animated.timing(w, { toValue: v, duration: 450, useNativeDriver: false }).start();
  }, [v, w]);
  return (
    <View style={{ height: 12, borderRadius: 6, backgroundColor: C.bg, boxShadow: S.insetSm, padding: 2 }}>
      <Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: C.accent,
        width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}
