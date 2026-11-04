import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import ActivityCard from '../../components/ActivityCard';
import { IconWell, NeuButton, NeuCard } from '../../components/Neu';
import { fmtKm } from '../../lib/geo';
import { useTheme } from '../../lib/theme';
import { SPORTS, type Sport } from '../../lib/types';
import { useActivities } from '../../lib/useActivities';

function startOfWeek(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x.getTime();
}

export default function Feed() {
  const { C, S, F } = useTheme();
  const { items, reload } = useActivities();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<Sport | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((a) =>
      (sport === 'all' || a.sport === sport) &&
      (!q || a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q)));
  }, [items, query, sport]);

  if (!items) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;

  const weekStart = startOfWeek();
  const week = items.filter((a) => a.startedAt >= weekStart);
  const weekDist = week.reduce((s, a) => s + a.distanceM, 0);

  const header = items.length ? (
    <View style={{ gap: 22, marginBottom: 22 }}>
      <NeuCard style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }} radius={28}>
        <IconWell icon="calendar-week" size={52} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={F.label}>This week · {week.length} activities</Text>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>{fmtKm(weekDist)} km</Text>
        </View>
      </NeuCard>

      <View style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
        borderRadius: 999, backgroundColor: C.bg, boxShadow: S.insetSm }}>
        <MaterialCommunityIcons name="magnify" size={20} color={C.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search activities" placeholderTextColor={C.muted}
          style={{ flex: 1, color: C.text, paddingVertical: 12, fontSize: 15 }} returnKeyType="search" />
        {query ? <MaterialCommunityIcons name="close-circle" size={18} color={C.muted} onPress={() => setQuery('')} /> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 12 }}>
        <NeuButton small label="All" selected={sport === 'all'} onPress={() => setSport('all')} />
        {SPORTS.map((s) => (
          <NeuButton key={s.key} small icon={s.icon as never} label={s.label} selected={sport === s.key} onPress={() => setSport(s.key)} />
        ))}
      </ScrollView>
    </View>
  ) : undefined;

  return (
    <FlatList
      data={filtered}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <ActivityCard a={item} />}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 20, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={C.accent} colors={[C.accent]}
          onRefresh={async () => { setRefreshing(true); reload(); setRefreshing(false); }} />
      }
      ListHeaderComponent={header}
      ListEmptyComponent={
        items.length ? (
          <Text style={{ color: C.muted, textAlign: 'center', marginTop: 20 }}>No activities match.</Text>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <IconWell icon="map-marker-path" size={96} />
            <Text style={[F.h2, { marginTop: 10 }]}>No activities yet</Text>
            <Text style={{ color: C.muted, textAlign: 'center' }}>Record your first run, ride or walk and it will show up here.</Text>
            <NeuButton accent icon="play" label="Start recording" onPress={() => router.navigate('/record')} style={{ marginTop: 8 }} />
          </View>
        )
      }
    />
  );
}
