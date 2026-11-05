import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import ActivityCard from '../../components/ActivityCard';
import FeedSkeleton from '../../components/Skeleton';
import { IconWell, NeuButton, NeuCard, NeuIconButton } from '../../components/Neu';
import type { ShareCardHandle } from '../../components/ShareCard';
import WeekRecapCard, { recapDateText } from '../../components/WeekRecapCard';
import { friends } from '../../lib/friendsApp';
import { fmtDuration } from '../../lib/geo';
import { getProfile } from '../../lib/storage';
import { activitySteps, fmtSteps } from '../../lib/steps';
import { compareWeeks } from '../../lib/records';
import { weekText } from '../../lib/shareText';
import { showToast } from '../../lib/toast';
import { defaultRecapWeek, isCurrentWeek, weekRecap, type WeekRecap } from '../../lib/weekRecap';
import { useTheme } from '../../lib/theme';
import { SPORTS, type Activity, type Sport } from '../../lib/types';
import { useActivities } from '../../lib/useActivities';
import { sportName, useT } from '../../lib/i18n';

const renderItem = ({ item }: { item: Activity }) => <ActivityCard a={item} />;

type Month = { key: string; title: string; km: number; steps: number; data: Activity[] };
/** Every activity, newest first, grouped by calendar month with that month's totals. */
function byMonth(acts: Activity[]): Month[] {
  const out: Month[] = [];
  for (const a of acts) {
    const d = new Date(a.startedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let m = out[out.length - 1];
    if (!m || m.key !== key) {
      m = { key, title: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), km: 0, steps: 0, data: [] };
      out.push(m);
    }
    m.data.push(a);
    m.km += a.distanceM / 1000;
    m.steps += activitySteps(a)?.steps ?? 0;
  }
  return out;
}

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

  const sections = useMemo(() => byMonth(filtered), [filtered]);

  // "Share my week": a card (image) or a text block for the group chat; last week early in the week
  const [recapWeek, setRecapWeek] = useState<number | null>(null);
  const [name, setName] = useState('Athlete');
  const [rank, setRank] = useState<number | null>(null);
  const recap = useMemo(() => weekRecap(items ?? [], recapWeek ?? defaultRecapWeek(items ?? [])), [items, recapWeek]);
  const recapRef = useRef<ShareCardHandle>(null);
  const weekLabels = { activities: t('wk.activities'), best: t('wk.best').toLowerCase(), steps: t('wk.steps').toLowerCase(),
    streak: t('wk.streak').toLowerCase(), vsLast: t('wk.vsLast'), rank: t('wk.rank') };
  const openShare = async (r: WeekRecap) => {
    setRecapWeek(r.start);
    const isThis = isCurrentWeek(r.start);
    const [p, rk] = await Promise.all([
      getProfile().catch(() => null),
      // friends rank only exists for the current week
      isThis && friends ? friends.isEnabled().then((on) => (on ? friends!.board('week') : [])).then((b) => b.find((x) => x.me)?.rank ?? null).catch(() => null) : Promise.resolve(null),
    ]);
    if (p?.name) setName(p.name);
    setRank(rk);
    const dateText = recapDateText(r);
    const text = weekText(r, { title: t('wk.title'), dateText, labels: weekLabels, rank: rk });
    const buttons = [
      { text: isThis ? t('wk.last') : t('wk.this'), onPress: () => openShare(weekRecap(items ?? [], isThis ? r.start - 7 * 86_400_000 : r.start + 7 * 86_400_000)) },
      { text: t('wk.text'), onPress: async () => { await Clipboard.setStringAsync(text); showToast(t('sh.copied')); } },
      { text: t('wk.image'), onPress: async () => {
        try {
          await new Promise((res) => setTimeout(res, 80)); // let the off-screen card render this week
          const uri = await captureRef(recapRef as unknown as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: 'tmpfile' });
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('wk.share') });
        } catch { showToast(t('sh.failed')); }
      } },
    ];
    Alert.alert(t('wk.share'), `${dateText}${r.count ? '' : `\n${t('wk.empty')}`}`,
      Platform.OS === 'ios' ? [{ text: t('rec.cancel'), style: 'cancel' }, ...buttons] : buttons, { cancelable: true });
  };

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
          <Text style={{ color: trend == null ? C.muted : trend >= 0 ? C.successInk : C.dangerInk, fontSize: 12, fontWeight: '700' }}>
            {trend == null ? t('feed.nothingLast') : `${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}% ${t('feed.vsLast')} (${cmp.lastKm.toFixed(1)} km)`}
          </Text>
        </View>
        <NeuIconButton icon="share-variant" size={40} accessibilityLabel={t('wk.share')} onPress={() => openShare(recap)} />
      </NeuCard>

      <View style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
        borderRadius: 999, backgroundColor: C.bg, boxShadow: S.insetSm }}>
        <MaterialCommunityIcons name="magnify" size={20} color={C.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('feed.search')} placeholderTextColor={C.muted}
          style={{ flex: 1, color: C.text, paddingVertical: 12, fontSize: 15 }} returnKeyType="search" />
        {query ? (
          <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel={t('feed.clear')} onPress={() => setQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={C.muted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 12 }}>
        <NeuButton small label={t('feed.all')} selected={sport === 'all'} onPress={() => setSport('all')} />
        {SPORTS.map((s) => (
          <NeuButton key={s.key} small icon={s.icon as never} label={sportName(t, s.key)} selected={sport === s.key} onPress={() => setSport(s.key)} />
        ))}
      </ScrollView>
    </View>
  ) : undefined;

  return (
    <>
    <SectionList
      sections={sections}
      keyExtractor={(a) => a.id}
      renderItem={renderItem}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View style={{ marginHorizontal: 26, marginBottom: 14, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={[F.label, { fontSize: 12 }]}>{section.title}</Text>
          <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>
            {section.data.length} {t('feed.activities')} · {section.km.toFixed(1)} km{section.steps ? ` · ${fmtSteps(section.steps)} 👣` : ''}
          </Text>
        </View>
      )}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={7}
      removeClippedSubviews
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 20, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={C.accent} colors={[C.accent]}
          onRefresh={async () => {
            setRefreshing(true);
            // long enough to be seen, so the pull visibly does something
            await Promise.all([reload(), new Promise((r) => setTimeout(r, 450))]);
            setRefreshing(false);
          }} />
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
    <View style={{ position: 'absolute', left: -10000, top: 0 }} pointerEvents="none">
      <WeekRecapCard ref={recapRef} recap={recap} name={name} rank={rank} />
    </View>
    </>
  );
}
