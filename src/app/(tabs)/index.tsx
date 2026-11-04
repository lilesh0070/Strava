import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import ActivityCard from '../../components/ActivityCard';
import { fmtKm } from '../../lib/geo';
import { C, F } from '../../lib/theme';
import { useActivities } from '../../lib/useActivities';

function startOfWeek(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x.getTime();
}

export default function Feed() {
  const { items, reload } = useActivities();
  const [refreshing, setRefreshing] = useState(false);

  if (!items) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;

  const weekStart = startOfWeek();
  const week = items.filter((a) => a.startedAt >= weekStart);
  const weekDist = week.reduce((s, a) => s + a.distanceM, 0);

  return (
    <FlatList
      data={items}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <ActivityCard a={item} />}
      contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={C.accent}
          onRefresh={async () => { setRefreshing(true); reload(); setRefreshing(false); }} />
      }
      ListHeaderComponent={
        items.length ? (
          <View style={{ marginHorizontal: 12, marginBottom: 12, padding: 16, borderRadius: 16, backgroundColor: C.cardAlt }}>
            <Text style={F.label}>This week</Text>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', marginTop: 4 }}>
              {fmtKm(weekDist)} km <Text style={{ color: C.muted, fontSize: 15, fontWeight: '500' }}>· {week.length} activities</Text>
            </Text>
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <MaterialCommunityIcons name="map-marker-path" size={64} color={C.muted} />
          <Text style={F.h2}>No activities yet</Text>
          <Text style={{ color: C.muted, textAlign: 'center' }}>Record your first run, ride or walk and it will show up here.</Text>
          <Pressable onPress={() => router.navigate('/record')}
            style={{ backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, marginTop: 8 }}>
            <Text style={{ color: C.accentText, fontWeight: '800' }}>Start recording</Text>
          </Pressable>
        </View>
      }
    />
  );
}
