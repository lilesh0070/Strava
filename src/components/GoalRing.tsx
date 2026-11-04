import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../lib/theme';

/** Circular goal progress sitting in an inset neumorphic well. */
export default function GoalRing({ value, label, sub, size = 110 }: { value: number; label: string; sub: string; size?: number }) {
  const { C, S } = useTheme();
  const stroke = 10, r = (size - stroke) / 2 - 6, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.bg, boxShadow: S.inset, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.faint} strokeWidth={stroke} fill="none" opacity={0.35} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.accent} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c * v} ${c}`} strokeLinecap="round" />
      </Svg>
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '900' }}>{label}</Text>
      <Text style={{ color: C.muted, fontSize: 10 }}>{sub}</Text>
    </View>
  );
}
