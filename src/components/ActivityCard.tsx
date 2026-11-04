import { router } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { fmtDuration, fmtKm, fmtPace, fmtSpeed } from '../lib/geo';
import { useTheme } from '../lib/theme';
import { sportInfo, type Activity } from '../lib/types';
import { IconWell, NeuCard } from './Neu';
import RouteThumb from './RouteThumb';
import Stat from './Stat';

export function fmtDate(t: number) {
  return new Date(t).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

export default function ActivityCard({ a }: { a: Activity }) {
  const { width } = useWindowDimensions();
  const { C, S, F } = useTheme();
  const info = sportInfo(a.sport);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a.name}, ${fmtKm(a.distanceM)} kilometres`}
      onPress={() => router.push(`/activity/${a.id}`)}
      style={({ pressed }) => ({
        backgroundColor: C.bg, borderRadius: 28, padding: 16, marginHorizontal: 20, marginBottom: 22,
        boxShadow: pressed ? S.inset : S.raised,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <IconWell icon={info.icon as never} />
        <View style={{ flex: 1 }}>
          <Text style={[F.h2, { fontSize: 17 }]} numberOfLines={1}>{a.name}</Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>{fmtDate(a.startedAt)}</Text>
        </View>
      </View>
      {a.description ? <Text style={{ color: C.text, marginBottom: 12 }} numberOfLines={3}>{a.description}</Text> : null}
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        <Stat label="Distance" value={fmtKm(a.distanceM)} unit="km" />
        {info.usesPace
          ? <Stat label="Pace" value={fmtPace(a.distanceM, a.movingSec)} unit="/km" />
          : <Stat label="Speed" value={fmtSpeed(a.distanceM, a.movingSec)} unit="km/h" />}
        <Stat label="Time" value={fmtDuration(a.movingSec)} />
      </View>
      <NeuCard inset radius={20} padding={4}>
        <RouteThumb segments={a.segments} width={width - 80} height={140} />
      </NeuCard>
    </Pressable>
  );
}
