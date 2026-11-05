import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { personalRecords } from '../../lib/records';
import { useActivities } from '../../lib/useActivities';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { fmtDate } from '../../components/ActivityCard';
import DetailsCard from '../../components/DetailsCard';
import ElevationChart from '../../components/ElevationChart';
import RouteMap from '../../components/RouteMap';
import RouteThumb from '../../components/RouteThumb';
import Stat from '../../components/Stat';
import { cumulative, fmtDuration, fmtKm, fmtPace, fmtSpeed, splits } from '../../lib/geo';
import { estimateCalories } from '../../lib/calories';
import { activitySteps, cadence, fmtSteps } from '../../lib/steps';
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
  const [full, setFull] = useState<Activity | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [weightKg, setWeightKg] = useState(70);
  const { items } = useActivities();
  const prs = useMemo(() => [...personalRecords(items ?? []).values()].filter((r) => r.activityId === id && r.kind === 'effort'), [items, id]);
  useEffect(() => { getProfile().then((p) => setWeightKg(p.weightKg)); }, []);

  useEffect(() => {
    getActivity(id).then((x) => { setFull(x); setName(x?.name ?? ''); }).catch(() => setFull(null));
  }, [id]);
  // the list summary is already in memory: show it at once, the full GPS points arrive a moment later
  const summary = useMemo(() => items?.find((x) => x.id === id) ?? null, [items, id]);
  const a = full ?? (full === undefined ? summary : null);
  const loaded = full != null;
  const setA = (next: Activity) => setFull(next);

  const data = useMemo(() => (loaded && a ? { splits: splits(a.segments), cum: cumulative(a.segments) } : null), [loaded, a]);
  const mapStyle = useMemo(() => ({ height: 280, borderRadius: 24 }), []);

  if (full === undefined && !summary) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;
  if (!a) return <Text style={[F.body, { padding: 20 }]}>{t('act.notFound')}</Text>;

  const info = sportInfo(a.sport);
  const splitRows = data?.splits ?? [];
  const fastest = splitRows.filter((s) => s.distanceM >= 1000).reduce((m, s) => Math.min(m, s.durationSec), Infinity);
  const bestPerKm = Math.min(...splitRows.map((s) => s.durationSec * (1000 / s.distanceM)));
  const maxAlt = data ? Math.max(...data.cum.alt.filter((x): x is number => x != null), -Infinity) : NaN;

  const saveFailed = (e: unknown) => Alert.alert(t('act.couldNotSave'), String((e as Error)?.message ?? e));
  const saveName = async () => {
    const next = { ...a, name: name.trim() || a.name };
    try { await saveActivity(next); } catch (e) { saveFailed(e); return; }
    setA(next); setEditing(false);
  };

  const update = async (next: Activity) => {
    const prev = a;
    setA(next);
    try { await saveActivity(next); } catch (e) { setA(prev); saveFailed(e); } // show what is really stored
  };

  // story sticker / photo story / classic card all live on the share screen
  const onShare = () => router.push(`/share/${a.id}`);

  const onExport = () => shareGpx(a).catch((e) => Alert.alert('Export failed', String(e?.message ?? e)));

  const onDelete = () => Alert.alert(t('act.deleteQ'), undefined, [
    { text: t('act.cancel'), style: 'cancel' },
    { text: t('act.delete'), style: 'destructive', onPress: async () => {
      let removed: Activity | null;
      try { removed = await deleteActivity(a.id); } catch (e) { Alert.alert(t('act.couldNotDelete'), String((e as Error)?.message ?? e)); return; }
      router.back();
      if (removed) {
        const back = removed;
        showToast(t('toast.deleted'), { label: t('toast.undo'), run: () => { saveActivity(back).catch(saveFailed); } });
      }
    } },
  ]);

  return (
    <>
      <Stack.Screen options={{
        title: info.label,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 4, paddingRight: 4 }}>
            <NeuIconButton icon="share-variant" size={38} accessibilityLabel={t('act.share')} onPress={onShare} />
            <NeuIconButton icon="file-export-outline" size={38} accessibilityLabel={t('act.export')} onPress={onExport} />
            <NeuIconButton icon="trash-can-outline" size={38} color={C.danger} accessibilityLabel={t('act.deleteA11y')} onPress={onDelete} />
          </View>
        ),
      }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {loaded && a.segments.some((g) => g.length > 1) ? (
          <View style={{ margin: 20, marginBottom: 0, borderRadius: 30, padding: 6, backgroundColor: C.bg, boxShadow: S.inset }}>
            <RouteMap segments={a.segments} style={mapStyle} />
          </View>
        ) : !loaded && a.segments.some((g) => g.length > 1) ? (
          <View style={{ margin: 20, marginBottom: 0, borderRadius: 30, padding: 6, backgroundColor: C.bg, boxShadow: S.inset, alignItems: 'center' }}>
            <RouteThumb segments={a.segments} width={width - 52} height={280} />
          </View>
        ) : null}
        <View style={{ padding: 20, gap: 24 }}>
          <View>
            <Text style={{ color: C.muted, fontSize: 13 }}>{fmtDate(a.startedAt)}</Text>
            {editing ? (
              <TextInput value={name} onChangeText={setName} autoFocus onSubmitEditing={saveName} onBlur={saveName}
                style={[F.h1, { backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }]} />
            ) : (
              <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityHint={t('act.rename')}
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
              <Stat label={t('act.distance')} value={fmtKm(a.distanceM)} unit="km" />
              {info.usesPace
                ? <Stat label={t('act.avgPace')} value={fmtPace(a.distanceM, a.movingSec)} unit="/km" />
                : <Stat label={t('act.avgSpeed')} value={fmtSpeed(a.distanceM, a.movingSec)} unit="km/h" />}
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Stat label={t('act.moving')} value={fmtDuration(a.movingSec)} />
              <Stat label={t('act.elapsed')} value={fmtDuration(a.elapsedSec)} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Stat label={t('act.elev')} value={String(a.elevGainM)} unit="m" />
              <Stat label={t('act.maxElev')} value={Number.isFinite(maxAlt) ? String(Math.round(maxAlt)) : '–'} unit="m" />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Stat label={t('act.calories')} value={String(estimateCalories(a.sport, a.distanceM, a.movingSec, weightKg))} unit="kcal" />
              {a.maxSpeedMs
                ? <Stat label={t('act.maxSpeed')} value={(a.maxSpeedMs * 3.6).toFixed(1)} unit="km/h" />
                : <Stat label={t('act.effort')} value={a.effort ? `${a.effort}/10` : '–'} />}
            </View>
            {(() => {
              const st = activitySteps(a), cad = cadence(a);
              return st ? (
                <View style={{ flexDirection: 'row' }}>
                  <Stat label={st.estimated ? t('act.stepsEst') : t('act.steps')} value={`${st.estimated ? '≈' : ''}${fmtSteps(st.steps)}`} />
                  <Stat label={t('act.cadence')} value={cad ? String(cad) : '–'} unit="spm" />
                </View>
              ) : null;
            })()}
            {a.manual ? <Text style={{ color: C.muted, fontSize: 12 }}>{t('act.manual')}</Text> : null}
          </NeuCard>

          {a.laps && a.laps.length > 1 && (
            <NeuCard radius={28} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <IconWell icon="flag-outline" />
                <Text style={F.h2}>{t('act.laps')}</Text>
              </View>
              {a.laps.map((l) => (
                <NeuCard key={l.n} inset radius={16} padding={10} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: C.muted, width: 36, fontWeight: '700' }}>#{l.n}</Text>
                  <Text style={{ color: C.text, flex: 1, fontVariant: ['tabular-nums'] }}>{fmtKm(l.distanceM)} km</Text>
                  <Text style={{ color: C.text, flex: 1, fontVariant: ['tabular-nums'] }}>{fmtDuration(l.durationSec)}</Text>
                  <Text style={{ color: C.accentInk, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    {info.usesPace ? `${fmtPace(l.distanceM, l.durationSec)}/km` : `${fmtSpeed(l.distanceM, l.durationSec)} km/h`}
                  </Text>
                </NeuCard>
              ))}
            </NeuCard>
          )}

          {loaded && <DetailsCard a={a} onChange={update} />}

          {loaded && <PaceChart segments={a.segments} usesPace={info.usesPace} width={width - 88} />}

          {data && data.cum.alt.some((x) => x != null) && (
            <NeuCard radius={28} style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconWell icon="image-filter-hdr" />
                <Text style={F.h2}>{t('act.elevation')}</Text>
              </View>
              <NeuCard inset radius={18} padding={8}>
                <ElevationChart d={data.cum.d} segments={a.segments} width={width - 88} height={110} />
              </NeuCard>
            </NeuCard>
          )}

          {splitRows.length > 0 && (
            <NeuCard radius={28} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <IconWell icon="format-list-numbered" />
                <Text style={F.h2}>{t('act.splits')}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <Text style={[F.label, { width: 40 }]}>{t('act.km')}</Text>
                <Text style={[F.label, { width: 70 }]}>{info.usesPace ? t('act.pace') : t('act.speed')}</Text>
              </View>
              {splitRows.map((s) => {
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
    </>
  );
}
