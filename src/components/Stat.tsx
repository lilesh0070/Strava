import { Text, View } from 'react-native';
import { useTheme } from '../lib/theme';

export default function Stat({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) {
  const { C, F } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: big ? 'center' : 'flex-start' }} accessible accessibilityLabel={`${label} ${value}${unit ? ` ${unit}` : ''}`}>
      <Text style={F.label} maxFontSizeMultiplier={1.4}>{label}</Text>
      <Text style={{ color: C.text, fontSize: big ? 38 : 20, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}
        maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit={big}>
        {value}
        {unit ? <Text style={{ fontSize: big ? 15 : 12, color: C.muted, fontWeight: '600' }}> {unit}</Text> : null}
      </Text>
    </View>
  );
}
