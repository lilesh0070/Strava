import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import ActivityCard from '../../components/ActivityCard';
import FeedSkeleton from '../../components/Skeleton';
import { IconWell, NeuButton, NeuCard } from '../../components/Neu';
import { fmtDuration, fmtKm } from '../../lib/geo';
import { compareWeeks } from '../../lib/records';
import { useTheme } from '../../lib/theme';
import { SPORTS, type Activity, type Sport } from '../../lib/types';
import { useActivities } from '../../lib/useActivities';
import { useT } from '../../lib/i18n';

const renderItem = ({ item }: { item: Activity }) => <ActivityCard a={item} />;

export default function Feed() {
  const { C, S, F } = useTheme();
  const { t } = useT();
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

  if (!items) return <FeedSkeleton />;

  const cmp = compareWeeks(items);
  const trend = cmp.changePct == null ? null : cmp.changePct;

  const header = items.length ? (
    <View style={{ gap: 22, marginBottom: 22 }}>
      <NeuCard style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }} radius={28}>
        <IconWell icon={trend != null && trend < 0 ? 'trending-down' : 'trending-up'} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={F.label}>{t('feed.thisWeek')} · {cmp.thisCount} {t('feed.activities')} · {fmtDuration(cmp.thisSec)}</Text>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>{cmp.thisKm.toFixed(1)} km</Text>
          <Text style={{ color: trend == null ? C.muted : trend >= 0 ? C.success : C.danger, fontSize: 12, fontWeight: '700' }}>
            {trend == null ? t('feed.nothingLast') : `${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}% ${t('feed.vsLast')} (${cmp.lastKm.toFixed(1)} km)`}
          </Text>
        </View>
      </NeuCard>

      <View style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
        borderRadius: 999, backgroundColor: C.bg, boxShadow: S.insetSm }}>
        <MaterialCommunityIcons name="magnify" size={20} color={C.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('feed.search')} placeholderTextColor={C.muted}
          style={{ flex: 1, color: C.text, paddingVertical: 12, fontSize: 15 }} returnKeyType="search" />
        {query ? <MaterialCommunityIcons name="close-circle" size={18} color={C.muted} onPress={() => setQuery('')} /> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 12 }}>
        <NeuButton small label={t('feed.all')} selected={sport === 'all'} onPress={() => setSport('all')} />
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
      renderItem={renderItem}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={7}
      removeClippedSubviews
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 20, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={C.accent} colors={[C.accent]}
          onRefresh={async () => { setRefreshing(true); reload(); setRefreshing(false); }} />
      }
      ListHeaderComponent={header}
      ListEmptyComponent={
        items.length ? (
          <Text style={{ color: C.muted, textAlign: 'center', marginTop: 20 }}>{t('feed.noMatch')}</Text>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <IconWell icon="map-marker-path" size={96} />
            <Text style={[F.h2, { marginTop: 10 }]}>{t('feed.emptyTitle')}</Text>
            <Text style={{ color: C.muted, textAlign: 'center' }}>{t('feed.emptyBody')}</Text>
            <NeuButton accent icon="play" label={t('feed.start')} onPress={() => router.navigate('/record')} style={{ marginTop: 8 }} />
          </View>
        )
      }
    />
  );
}
