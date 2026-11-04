import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { fmtDuration, fmtKm, fmtPace, fmtSpeed } from '../lib/geo';
import { C, F } from '../lib/theme';
import { sportInfo, type Activity } from '../lib/types';
import RouteThumb from './RouteThumb';
import Stat from './Stat';

export function fmtDate(t: number) {
  return new Date(t).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

export default function ActivityCard({ a }: { a: Activity }) {
  const { width } = useWindowDimensions();
  const info = sportInfo(a.sport);
  return (
    <Pressable
      onPress={() => router.push(`/activity/${a.id}`)}
      style={({ pressed }) => ({
        backgroundColor: C.card, borderRadius: 16, padding: 16, marginHorizontal: 12, marginBottom: 12,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name={info.icon as never} size={20} color={C.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={F.h2} numberOfLines={1}>{a.name}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{fmtDate(a.startedAt)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <Stat label="Distance" value={fmtKm(a.distanceM)} unit="km" />
        {info.usesPace
          ? <Stat label="Pace" value={fmtPace(a.distanceM, a.movingSec)} unit="/km" />
          : <Stat label="Speed" value={fmtSpeed(a.distanceM, a.movingSec)} unit="km/h" />}
        <Stat label="Time" value={fmtDuration(a.movingSec)} />
      </View>
      <RouteThumb segments={a.segments} width={width - 56} height={150} />
    </Pressable>
  );
}
