// Neumorphic building blocks.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../lib/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

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
export function NeuButton({ label, icon, onPress, selected, accent, style, small, disabled, accessibilityLabel }: {
  label?: string; icon?: IconName; onPress?: () => void; selected?: boolean; accent?: boolean;
  style?: StyleProp<ViewStyle>; small?: boolean; disabled?: boolean; accessibilityLabel?: string;
}) {
  const { C, S } = useTheme();
  const fg = accent ? C.accentText : selected ? C.accent : C.text;
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={() => { Haptics.selectionAsync().catch(() => undefined); onPress?.(); }}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingHorizontal: small ? 14 : 20, paddingVertical: small ? 9 : 14, borderRadius: 999,
        backgroundColor: accent ? C.accent : C.bg,
        boxShadow: pressed || selected ? (small ? S.insetSm : S.inset) : accent ? S.glow : small ? S.raisedSm : S.raised,
        opacity: disabled ? 0.5 : 1,
      }, style]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={small ? 16 : 20} color={fg} /> : null}
      {label ? <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{label}</Text> : null}
    </Pressable>
  );
}

/** Round icon button, e.g. the settings cog or the record controls. */
export function NeuIconButton({ icon, onPress, size = 44, accent, color, accessibilityLabel }: {
  icon: IconName; onPress?: () => void; size?: number; accent?: boolean; color?: string; accessibilityLabel: string;
}) {
  const { C, S } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={() => { Haptics.selectionAsync().catch(() => undefined); onPress?.(); }}
      style={({ pressed }) => ({
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: accent ? C.accent : C.bg,
        boxShadow: pressed ? S.inset : accent ? S.glow : size > 56 ? S.raised : S.raisedSm,
      })}
    >
      <MaterialCommunityIcons name={icon} size={size * 0.45} color={color ?? (accent ? C.accentText : C.text)} />
    </Pressable>
  );
}

/** Inset track switch. */
export function NeuSwitch({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel: string }) {
  const { C, S } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={accessibilityLabel}
      onPress={() => { Haptics.selectionAsync().catch(() => undefined); onValueChange(!value); }}
      style={{ width: 56, height: 30, borderRadius: 15, backgroundColor: C.bg, boxShadow: S.insetSm, padding: 4,
        alignItems: value ? 'flex-end' : 'flex-start' }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: value ? C.accent : C.bg, boxShadow: S.raisedSm }} />
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
          <Pressable key={o.key} accessibilityRole="button" accessibilityState={{ selected: sel }}
            onPress={() => { Haptics.selectionAsync().catch(() => undefined); onChange(o.key); }}
            style={{ flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 9,
              borderRadius: 999, backgroundColor: C.bg, boxShadow: sel ? S.raisedSm : undefined }}>
            {o.icon ? <MaterialCommunityIcons name={o.icon} size={16} color={sel ? C.accent : C.muted} /> : null}
            <Text style={{ color: sel ? C.accent : C.muted, fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
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

/** Tile: icon well + title + subtitle, like a settings or category card. */
export function NeuTile({ icon, title, subtitle, onPress, right, style }: {
  icon: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const { C, S } = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={() => { Haptics.selectionAsync().catch(() => undefined); onPress?.(); }}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 26,
        backgroundColor: C.bg, boxShadow: pressed ? S.inset : S.raised }, style]}
    >
      <IconWell icon={icon} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Inset progress bar. */
export function NeuProgress({ value }: { value: number }) {
  const { C, S } = useTheme();
  return (
    <View style={{ height: 12, borderRadius: 6, backgroundColor: C.bg, boxShadow: S.insetSm, padding: 2 }}>
      <View style={{ height: 8, borderRadius: 4, width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: C.accent }} />
    </View>
  );
}
