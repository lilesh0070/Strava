import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import ShareCard, { type ShareCardHandle } from '../../components/ShareCard';
import { personalRecords } from '../../lib/records';
import { useActivities } from '../../lib/useActivities';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { fmtDate } from '../../components/ActivityCard';
import DetailsCard from '../../components/DetailsCard';
import ElevationChart from '../../components/ElevationChart';
import RouteMap from '../../components/RouteMap';
import Stat from '../../components/Stat';
import { cumulative, fmtDuration, fmtKm, fmtPace, fmtSpeed, splits } from '../../lib/geo';
import { estimateCalories } from '../../lib/calories';
import PaceChart from '../../components/PaceChart';
import { deleteActivity, getActivity, getProfile, saveActivity } from '../../lib/storage';
import { shareGpx } from '../../lib/exportGpx';
import { useTheme } from '../../lib/theme';
import { showToast } from '../../lib/toast';
import { IconWell, NeuCard, NeuIconButton } from '../../components/Neu';
import { sportInfo, type Activity } from '../../lib/types';
import { useT } from '../../lib/i18n';

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { C, S, F } = useTheme();
  const { t } = useT();
  const [a, setA] = useState<Activity | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [weightKg, setWeightKg] = useState(70);
  const shareRef = useRef<ShareCardHandle>(null);
  const { items } = useActivities();
  const prs = useMemo(() => [...personalRecords(items ?? []).values()].filter((r) => r.activityId === id && r.kind === 'effort'), [items, id]);
  useEffect(() => { getProfile().then((p) => setWeightKg(p.weightKg)); }, []);

  useEffect(() => { getActivity(id).then((x) => { setA(x); setName(x?.name ?? ''); }); }, [id]);

  const data = useMemo(() => (a ? { splits: splits(a.segments), cum: cumulative(a.segments) } : null), [a]);

  if (a === undefined) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;
  if (!a || !data) return <Text style={[F.body, { padding: 20 }]}>Activity not found.</Text>;

  const info = sportInfo(a.sport);
  const fastest = data.splits.filter((s) => s.distanceM >= 1000).reduce((m, s) => Math.min(m, s.durationSec), Infinity);
  const bestPerKm = Math.min(...data.splits.map((s) => s.durationSec * (1000 / s.distanceM)));
  const maxAlt = Math.max(...data.cum.alt.filter((x): x is number => x != null), -Infinity);

  const saveName = async () => {
    const next = { ...a, name: name.trim() || a.name };
    await saveActivity(next);
    setA(next); setEditing(false);
  };

  const update = async (next: Activity) => { setA(next); await saveActivity(next); };

  const onShare = async () => {
    try {
      const uri = await captureRef(shareRef as unknown as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share activity' });
    } catch (e) { Alert.alert('Could not share', String((e as Error)?.message ?? e)); }
  };

  const onExport = () => shareGpx(a).catch((e) => Alert.alert('Export failed', String(e?.message ?? e)));

  const onDelete = () => Alert.alert('Delete activity?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      const removed = await deleteActivity(a.id);
      router.back();
      if (removed) showToast(t('toast.deleted'), { label: t('toast.undo'), run: () => { saveActivity(removed); } });
    } },
  ]);

  return (
    <>
      <Stack.Screen options={{
        title: info.label,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 4, paddingRight: 4 }}>
            <NeuIconButton icon="share-variant" size={38} accessibilityLabel="Share as image" onPress={onShare} />
            <NeuIconButton icon="file-export-outline" size={38} accessibilityLabel="Export GPX" onPress={onExport} />
            <NeuIconButton icon="trash-can-outline" size={38} color={C.danger} accessibilityLabel="Delete activity" onPress={onDelete} />
          </View>
        ),
      }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {a.segments.some((g) => g.length > 1) ? (
          <View style={{ margin: 20, marginBottom: 0, borderRadius: 30, padding: 6, backgroundColor: C.bg, boxShadow: S.inset }}>
            <RouteMap segments={a.segments} style={{ height: 280, borderRadius: 24 }} />
          </View>
        ) : null}
        <View style={{ padding: 20, gap: 24 }}>
          <View>
            <Text style={{ color: C.muted, fontSize: 13 }}>{fmtDate(a.startedAt)}</Text>
            {editing ? (
              <TextInput value={name} onChangeText={setName} autoFocus onSubmitEditing={saveName} onBlur={saveName}
                style={[F.h1, { backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }]} />
            ) : (
              <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityHint="Rename"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <IconWell icon={info.icon as never} size={40} />
                <Text style={[F.h1, { flex: 1 }]}>{a.name}</Text>
              </Pressable>
            )}
          </View>

          {prs.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {prs.map((r) => (
                <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7,
                  borderRadius: 999, backgroundColor: C.accent, boxShadow: S.glow }}>
                  <Text style={{ color: C.accentText, fontWeight: '800', fontSize: 12 }}>🏆 {r.label} · {fmtDuration(r.value)}</Text>
                </View>
              ))}
            </View>
          )}

          <NeuCard radius={28} style={{ gap: 18 }}>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Distance" value={fmtKm(a.distanceM)} unit="km" />
              {info.usesPace
                ? <Stat label="Avg pace" value={fmtPace(a.distanceM, a.movingSec)} unit="/km" />
                : <Stat label="Avg speed" value={fmtSpeed(a.distanceM, a.movingSec)} unit="km/h" />}
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Moving time" value={fmtDuration(a.movingSec)} />
              <Stat label="Elapsed" value={fmtDuration(a.elapsedSec)} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Elev gain" value={String(a.elevGainM)} unit="m" />
              <Stat label="Max elev" value={Number.isFinite(maxAlt) ? String(Math.round(maxAlt)) : '–'} unit="m" />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Calories" value={String(estimateCalories(a.sport, a.distanceM, a.movingSec, weightKg))} unit="kcal" />
              {a.maxSpeedMs
                ? <Stat label="Max speed" value={(a.maxSpeedMs * 3.6).toFixed(1)} unit="km/h" />
                : <Stat label="Effort" value={a.effort ? `${a.effort}/10` : '–'} />}
            </View>
            {a.manual ? <Text style={{ color: C.muted, fontSize: 12 }}>Added manually · no GPS route</Text> : null}
          </NeuCard>

          {a.laps && a.laps.length > 1 && (
            <NeuCard radius={28} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <IconWell icon="flag-outline" />
                <Text style={F.h2}>Laps</Text>
              </View>
              {a.laps.map((l) => (
                <NeuCard key={l.n} inset radius={16} padding={10} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: C.muted, width: 36, fontWeight: '700' }}>#{l.n}</Text>
                  <Text style={{ color: C.text, flex: 1, fontVariant: ['tabular-nums'] }}>{fmtKm(l.distanceM)} km</Text>
                  <Text style={{ color: C.text, flex: 1, fontVariant: ['tabular-nums'] }}>{fmtDuration(l.durationSec)}</Text>
                  <Text style={{ color: C.accent, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    {info.usesPace ? `${fmtPace(l.distanceM, l.durationSec)}/km` : `${fmtSpeed(l.distanceM, l.durationSec)} km/h`}
                  </Text>
                </NeuCard>
              ))}
            </NeuCard>
          )}

          <DetailsCard a={a} onChange={update} />

          <PaceChart segments={a.segments} usesPace={info.usesPace} width={width - 88} />

          {data.cum.alt.some((x) => x != null) && (
            <NeuCard radius={28} style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconWell icon="image-filter-hdr" />
                <Text style={F.h2}>Elevation</Text>
              </View>
              <NeuCard inset radius={18} padding={8}>
                <ElevationChart d={data.cum.d} alt={data.cum.alt} width={width - 88} height={110} />
              </NeuCard>
            </NeuCard>
          )}

          {data.splits.length > 0 && (
            <NeuCard radius={28} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <IconWell icon="format-list-numbered" />
                <Text style={F.h2}>Splits</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <Text style={[F.label, { width: 40 }]}>Km</Text>
                <Text style={[F.label, { width: 70 }]}>{info.usesPace ? 'Pace' : 'Speed'}</Text>
              </View>
              {data.splits.map((s) => {
                const perKm = s.durationSec * (1000 / s.distanceM);
                const isBest = s.durationSec === fastest;
                return (
                  <View key={s.km} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: C.text, width: 40, fontVariant: ['tabular-nums'] }}>
                      {s.distanceM < 1000 ? (s.distanceM / 1000).toFixed(2) : s.km}
                    </Text>
                    <Text style={{ color: C.text, width: 70, fontVariant: ['tabular-nums'] }}>
                      {info.usesPace ? fmtPace(s.distanceM, s.durationSec) : fmtSpeed(s.distanceM, s.durationSec)}
                    </Text>
                    <View style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: C.bg, boxShadow: S.insetSm, padding: 3 }}>
                      <View style={{ height: 8, borderRadius: 4, width: `${Math.max(8, (bestPerKm / perKm) * 100)}%`,
                        backgroundColor: isBest ? C.accent : C.faint }} />
                    </View>
                  </View>
                );
              })}
            </NeuCard>
          )}
        </View>
      </ScrollView>
      {/* rendered off-screen, only used as the source for the share image */}
      <View style={{ position: 'absolute', left: -10000, top: 0 }} pointerEvents="none">
        <ShareCard ref={shareRef} a={a} />
      </View>
    </>
  );
}
