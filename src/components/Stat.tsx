import { Text, View } from 'react-native';
import { C, F } from '../lib/theme';

export default function Stat({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: big ? 'center' : 'flex-start' }}>
      <Text style={F.label}>{label}</Text>
      <Text style={{ color: C.text, fontSize: big ? 40 : 20, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {value}
        {unit ? <Text style={{ fontSize: big ? 16 : 13, color: C.muted, fontWeight: '500' }}> {unit}</Text> : null}
      </Text>
    </View>
  );
}
